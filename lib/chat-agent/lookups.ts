/**
 * Running what the planner decided (plan.ts), and reading what came back.
 *
 * Split from plan.ts on 2026-10-22, when the web fallback pushed it past the
 * 300-line ceiling: planning is pure, running is not, and the two are read
 * for different reasons.
 */
import type { ReaderContext } from '../chat-context';
import type { ToolEnv } from '../chat-tools/ledger';
import { CHAT_TOOLS, runTool } from '../chat-tools/registry';
import { withAliases } from '../chat-tools/tool';
import { isPageRecord, type AgentEvent } from './answer';
import { safeArgs, type ToolRequest } from './parse';
import type { Plan } from './plan';
import type { Route } from './route';
import { missingLinks, webStatusOf, type MissingLink, type WebStatus } from './ladder';

const call = (name: string, args: Record<string, unknown>): ToolRequest => ({
  name,
  args: JSON.stringify(args),
});

/**
 * The planned lookups, run — and, when the question needs the world outside
 * (route.ts), the web searched IN PARALLEL, before any model sees it.
 *
 * History. The web used to open only after a failure: an EMPTY lookup (seen
 * live 2026-10-22: told "call web_search now", the fallback model answered
 * "not in Substrata's database" instead), or a part of the question no
 * lookup covered (ladder.ts `missingLinks`; 2026-10-24, the buyers of
 * Kazakhstan's uranium). Both triggers stay. But the owner read the chats the
 * same day and found an Ask that behaved like a database front-end: asked for
 * Kazatomprom's 2026 guidance or its competitors' share prices, corpus rows
 * came back, nothing was "empty", and the web was never read. So the route
 * decides up front, and the search costs no extra wait: it runs beside the
 * corpus lookups. A missing link the first search did not target gets one
 * more, aimed at it.
 *
 * The web's outcome is returned in its four states, because "not configured",
 * "could not reach it", "found nothing" and "found pages" are four different
 * sentences to a reader, and silence is none of them.
 */
export async function runPlan(
  plan: Plan,
  question: string,
  context: ReaderContext,
  env: ToolEnv,
  emit: (event: AgentEvent) => void,
  route?: Pick<Route, 'web' | 'query'>,
): Promise<{ results: string[]; empty: boolean; web?: WebStatus; gaps: MissingLink[] }> {
  const upFront = Boolean(route?.web);
  if (!plan.calls.length && !upFront) return { results: [], empty: false, gaps: [] };
  const search = (query: string) => runLookups([call('web_search', { query })], context, env, emit);
  const [results, early] = await Promise.all([
    plan.calls.length ? runLookups(plan.calls, context, env, emit) : Promise.resolve([]),
    upFront && env.web ? search(route!.query) : Promise.resolve([] as string[]),
  ]);
  const empty = results.some(lookupIsEmpty);
  const gaps = missingLinks(question, results);
  if (!empty && !gaps.length && !upFront) return { results, empty, gaps };
  if (!env.web) return { results, empty, web: 'off', gaps };
  let web = early.length ? webStatusOf(early[0]) : undefined;
  const found = [...early];
  // A missing link gets a search aimed at it, unless the first search could not reach the web.
  const gapQuery = gaps[0]?.search;
  if ((gapQuery && web !== 'could_not_look') || (!early.length && (empty || gaps.length))) {
    const more = await search(gapQuery ?? (plan.webQuery || question));
    const status = webStatusOf(more[0]);
    found.push(...more);
    web = web === 'found' || status === 'found' ? 'found' : (web ?? status);
  }
  return { results: [...results, ...found], empty, web, gaps };
}

export async function runLookups(
  calls: ToolRequest[],
  context: ReaderContext,
  env: ToolEnv,
  emit: (event: AgentEvent) => void,
): Promise<string[]> {
  for (const c of calls) {
    const tool = CHAT_TOOLS.find((t) => t.name === c.name);
    const label = tool?.label(withAliases(tool.parameters, safeArgs(c.args)));
    emit({ type: 'tool', label: label ?? c.name });
  }
  const outs = await Promise.all(
    calls.map((c) =>
      isPageRecord(c, context)
        ? {
            result: '{"note":"This is the record on this page; it is already given to you above."}',
          }
        : runTool(c.name, c.args, env),
    ),
  );
  return outs.map((o, i) => `[${calls[i].name}] ${o.result}`);
}

/**
 * Whether a tool result carries nothing to answer from: every list in it is
 * empty and what remains is a note, a warning or an error. A result with one
 * row is not empty, whatever note sits beside it.
 *
 * Why the loop asks: a planned lookup that came back empty — no rows, only
 * "no record matches" — is not an answer. Seen live (2026-10-22): a question
 * about a country the corpus had little on was planned, looked up, found
 * nothing, and the model was then capped at one round and told to write — so
 * it wrote "not in our data" and stopped, with the web tool never within
 * reach. The loop treats "some lookups empty", not "every lookup empty", as
 * the signal: the question about Niger planned two lookups, the uranium
 * bottleneck (found) and Niger's production table (nothing), and one found
 * record must not close the door on the part that was not.
 */
export function lookupIsEmpty(result: string): boolean {
  const json = result.replace(/^\[[^\]]+\]\s*/, '');
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return !json.trim();
  }
  const empty = (v: unknown): boolean => {
    if (v === null || v === undefined || v === '' || v === false || v === 0) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object')
      return Object.entries(v as Record<string, unknown>).every(
        ([k, x]) => LOOKUP_META_KEYS.has(k) || empty(x),
      );
    return false;
  };
  return empty(value);
}

/**
 * Keys that describe a lookup rather than answer it: what was asked, where
 * the full list lives, what to try next. Seen live (2026-10-22): the Niger
 * roles lookup came back with zero roles and a filter block, a board link, a
 * status line and a hint — read as "data", so the model re-ran the board
 * without the country, got 388 US roles, and wrote the wall.
 */
const LOOKUP_META_KEYS = new Set([
  'note',
  'warning',
  'error',
  'cite_as',
  'query',
  'tip',
  'hint',
  'status',
  'filter',
  'board',
  'relaxed',
]);
