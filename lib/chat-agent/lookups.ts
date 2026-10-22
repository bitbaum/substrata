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

const call = (name: string, args: Record<string, unknown>): ToolRequest => ({
  name,
  args: JSON.stringify(args),
});

/**
 * The planned lookups, run — and when one of them comes back empty and the
 * web is configured, the web searched for the question too, before any model
 * sees it. Seen live (2026-10-22, twice): told "call web_search now", the
 * fallback model answered "not in Substrata's database" instead. An empty
 * lookup opens the web in code, not by request; the model is then handed the
 * pages and asked to answer from them.
 */
export async function runPlan(
  plan: Plan,
  question: string,
  context: ReaderContext,
  env: ToolEnv,
  emit: (event: AgentEvent) => void,
): Promise<{ results: string[]; empty: boolean; web: boolean }> {
  if (!plan.calls.length) return { results: [], empty: false, web: false };
  const results = await runLookups(plan.calls, context, env, emit);
  const empty = results.some(lookupIsEmpty);
  if (!empty || !env.web) return { results, empty, web: false };
  const found = await runLookups([call('web_search', { query: question })], context, env, emit);
  return { results: [...results, ...found], empty, web: true };
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
