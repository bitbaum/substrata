/**
 * The lookups a question obviously needs, made BEFORE the model is called.
 *
 * Measured live 2026-09-25: of the 15-33 s an answer took, almost all was model
 * rounds — the model asked for tools, waited, asked again, and only then wrote.
 * Every round is a full call on a free tier metered per minute, so the second
 * one often spilled from Groq (0.2 s to first word) to OpenRouter (10 s+).
 * Most of those calls were predictable from where the reader was and the words
 * they used, so they are made here, locally and in parallel, and the model
 * gets one call to write.
 *
 * Deliberately conservative. A plan is `confident` only when it found the
 * record the question is about AND recognised what is being asked of it; then
 * the model is offered no tools at all. Otherwise the model still gets its
 * tools, with the planned results already in hand and one round to use them.
 * The web is never pre-fetched: it is the slowest lookup and only the model can
 * judge that the corpus is not enough.
 */
import { BOTTLENECKS, type Bottleneck } from '../bottlenecks';
import { MARKET_PARTICIPANTS, type MarketParticipant } from '../participants';
import type { ReaderContext } from '../chat-context';
import { norm } from '../chat-tools/resolve';
import type { ToolEnv } from '../chat-tools/ledger';
import { CHAT_TOOLS, runTool } from '../chat-tools/registry';
import { isPageRecord, type AgentEvent } from './answer';
import { safeArgs, type ToolRequest } from './parse';

export interface Plan {
  calls: ToolRequest[];
  /** The planned results answer the question as asked: offer no tools. */
  confident: boolean;
}

const NEWS =
  /\b(new|news|latest|recent(ly)?|update[sd]?|changed?|happen(ed|ing)?|lately|this (week|month))\b/;
const EXPOSURE =
  /\b(listed|tickers?|stocks?|shares|equit(y|ies)|exposed|exposure|invest(ors?|able)?|public(ly)? (traded|compan(y|ies))|traded)\b/;
const MAKERS = /\b(who makes|makers?|producers?|suppliers?|who (supplies|produces)|sourced)\b/;
const DEPENDS =
  /\b(depends?|depending|dependen(t|ts|cy|cies)|rests? on|downstream|upstream|supply chain)\b/;

const STOP = new Set(['and', 'the', 'for', 'with', 'from', 'slots', 'grade', 'high', 'large']);

/** The bottleneck a question names, by its most distinctive words — or none when two tie. */
export function bottleneckIn(question: string): Bottleneck | undefined {
  const q = ` ${norm(question)} `;
  let best: { b: Bottleneck; score: number } | undefined;
  let tied = false;
  for (const b of BOTTLENECKS) {
    const words = norm(b.name)
      .split(' ')
      .filter((w) => w.length > 3 && !STOP.has(w));
    // "transformer" should meet "transformers": match a word or its plural.
    const score = words.filter((w) => q.includes(` ${w} `) || q.includes(` ${w}s `)).length;
    if (!score) continue;
    if (!best || score > best.score) {
      best = { b, score };
      tied = false;
    } else if (score === best.score) tied = true;
  }
  return best && !tied ? best.b : undefined;
}

/** Companies a question names as whole words, longest names first, at most two. */
export function companiesIn(question: string): MarketParticipant[] {
  const q = ` ${norm(question)} `;
  return MARKET_PARTICIPANTS.filter((p) => {
    const n = norm(p.name);
    return n.length >= 3 && q.includes(` ${n} `);
  })
    .sort((a, b) => b.name.length - a.name.length)
    .slice(0, 2);
}

const call = (name: string, args: Record<string, unknown>): ToolRequest => ({
  name,
  args: JSON.stringify(args),
});

/**
 * What to look up before the first model call. Pure: no model, no network;
 * the calls it returns go through the same `runTool` the model's would.
 */
export function planLookups(
  question: string,
  context: ReaderContext,
  env: Pick<ToolEnv, 'leads'>,
): Plan {
  const q = question.toLowerCase();
  const onExposure = /^\/exposure(\/|\?|$)/.test(context.path ?? '');
  const page = context.entity;
  const pageBottleneck = page?.kind === 'bottleneck' ? page.key : undefined;
  const pageCompany = page?.kind === 'company' ? page.key : undefined;
  const named = bottleneckIn(question);
  const bottleneck = named?.slug ?? pageBottleneck;
  const companies = companiesIn(question).filter((c) => c.slug !== pageCompany);
  const company = companies[0]?.slug ?? pageCompany;

  const calls: ToolRequest[] = [];
  let intent = false;
  if (named && named.slug !== pageBottleneck)
    calls.push(call('get_bottleneck', { name: named.slug }));
  for (const c of companies) calls.push(call('get_company', { name: c.slug }));

  if (EXPOSURE.test(q) || onExposure) {
    intent = true;
    calls.push(
      call(
        'listed_exposure',
        bottleneck ? { bottleneck } : company ? { company } : { listed_only: /\blisted\b/.test(q) },
      ),
    );
  } else if (DEPENDS.test(q) && (bottleneck || company)) {
    intent = true;
    calls.push(
      call('trace_dependencies', {
        name: bottleneck ?? company,
        direction: bottleneck && !company ? 'downstream' : 'upstream',
      }),
    );
  }
  if (NEWS.test(q)) {
    intent = true;
    if (bottleneck) {
      if (env.leads) calls.push(call('recent_leads', { bottleneck }));
    } else if (company) calls.push(call('list_events', { company }));
    else if (env.leads) calls.push(call('recent_leads', {}));
  }
  if (MAKERS.test(q) && (bottleneck || company)) intent = true;

  // Nothing recognised: no guess. A corpus search here would list its eight
  // hits among the records read whether or not the answer used them.
  return { calls: calls.slice(0, 4), confident: Boolean(bottleneck || company) && intent };
}

/**
 * Calls run together. Labels go out first so the reader sees everything being
 * looked up at once; results come back in call order. Used for the planned
 * lookups and for every round of calls the model asks for.
 */
export async function runLookups(
  calls: ToolRequest[],
  context: ReaderContext,
  env: ToolEnv,
  emit: (event: AgentEvent) => void,
): Promise<string[]> {
  for (const c of calls) {
    const label = CHAT_TOOLS.find((t) => t.name === c.name)?.label(safeArgs(c.args));
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
