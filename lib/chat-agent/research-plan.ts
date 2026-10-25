/**
 * Research mode, step one: the question taken apart into the few questions an
 * analyst would answer first (docs/architecture/2026-10-25-research-mode.md).
 *
 * Asked "what do you think will be the demand for neon in the future?"
 * (2026-10-25), the Ask searched the question's own words once, read six
 * pages and used almost nothing from them: no global supply, no drivers, no
 * shock and recovery, no forecasts. An analyst would have asked five smaller
 * questions — who supplies it, what drives demand, what threatens supply,
 * what the price did, who has published a forecast — and searched each.
 *
 * One model call writes that plan as JSON; code decides whether it is a plan:
 * 3–6 sub-questions, each with a search query, and corpus tools only from a
 * short list with arguments the tool declares. Anything else — no answer in
 * time, no JSON, too few sub-questions — falls back to a plan built in code
 * from the question's kind, so the reader never waits on a bad plan.
 */
import type { ChatMessage } from '@bitbaum/ai-kit';
import { CHAT_TOOLS } from '../chat-tools/registry';
import type { ToolRequest } from './parse';
import { webQuery } from './plan';
import type { ModelTurn } from './turn';

export interface SubQuestion {
  /** Short stable id: `supply`, `drivers`, … — what a gap is filed under. */
  id: string;
  /** The sub-question in words, shown as "Searching: <ask>…". */
  ask: string;
  /** What the web engine is asked for it. */
  query: string;
}

export interface ResearchPlan {
  /** What the question is about, in a few words ("neon", "small modular reactors"). */
  subject: string;
  subQuestions: SubQuestion[];
  /** Corpus lookups the plan asked for, validated (at most MAX_CORPUS_CALLS). */
  calls: ToolRequest[];
  /** `model` when the planning call gave a valid plan, `code` when the fallback did. */
  by: 'model' | 'code';
}

/** The budget of a plan. Searches run in parallel, so the count bounds cost, not wait. */
export const PLAN_LIMITS = {
  minSubQuestions: 3,
  maxSubQuestions: 6,
  maxCorpusCalls: 4,
  /** The planning call: past this the code plan is used. */
  planMs: 7000,
} as const;

/** Corpus tools a plan may name: the ones that hold series, producers, relations and rules. */
export const PLAN_TOOLS = [
  'find_numbers',
  'resource_production',
  'producers_in',
  'related_to',
  'restrictions_on',
  'sanctions_on',
  'scenario_impact',
  'get_bottleneck',
  'relief_technologies',
] as const;

const clean = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** A tool call the plan named, kept only when the tool is on the list and its arguments are its own. */
function validCall(raw: unknown): ToolRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const { name, args } = raw as { name?: unknown; args?: unknown };
  if (typeof name !== 'string' || !(PLAN_TOOLS as readonly string[]).includes(name)) return null;
  const tool = CHAT_TOOLS.find((t) => t.name === name);
  const params = tool?.parameters as
    { properties?: Record<string, unknown>; required?: string[] } | undefined;
  if (!tool || !params) return null;
  const allowed = Object.keys(params.properties ?? {});
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries((args ?? {}) as Record<string, unknown>)) {
    const value = clean(v, 80);
    if (allowed.includes(k) && value) out[k] = value;
  }
  if ((params.required ?? []).some((k) => !out[k])) return null;
  return { name, args: JSON.stringify(out) };
}

/** The model's plan, validated in code; null when it is not one. */
export function parsePlan(text: string): Omit<ResearchPlan, 'by'> | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { subject?: unknown; subQuestions?: unknown; tools?: unknown };
  const subject = clean(r.subject, 60);
  const seen = new Set<string>();
  const subQuestions: SubQuestion[] = [];
  for (const s of Array.isArray(r.subQuestions) ? r.subQuestions : []) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const ask = clean(o.ask, 140);
    const query = clean(o.query, 120);
    const id =
      clean(o.id, 24)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') || `q${seen.size + 1}`;
    if (ask.length < 8 || query.length < 4 || seen.has(id) || seen.has(query.toLowerCase()))
      continue;
    seen.add(id).add(query.toLowerCase());
    subQuestions.push({ id, ask, query });
    if (subQuestions.length === PLAN_LIMITS.maxSubQuestions) break;
  }
  if (!subject || subQuestions.length < PLAN_LIMITS.minSubQuestions) return null;
  const calls = (Array.isArray(r.tools) ? r.tools : [])
    .map(validCall)
    .filter((c): c is ToolRequest => Boolean(c))
    .filter((c, i, all) => all.findIndex((x) => x.name === c.name && x.args === c.args) === i)
    .slice(0, PLAN_LIMITS.maxCorpusCalls);
  return { subject, subQuestions, calls };
}

/** The subject of a question with its analysis words taken out: "neon", "small modular reactors". */
export function subjectOf(question: string): string {
  return (
    webQuery(question)
      .replace(
        /\b(you think|think|give (me )?sources?|sources?|please|future|in the future|outlook|forecast|demand( for| on)?|will|happen(s)?|what|the|be|of|for|on|if|compare|impact|commercial|when|again|could|would|to|cut|is|are|do)\b/gi,
        ' ',
      )
      .replace(/[?.!,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || webQuery(question)
  );
}

/** The plan built in code, by the question's kind: what an analyst asks first. */
export function fallbackPlan(question: string, today: string): ResearchPlan {
  const s = subjectOf(question);
  const y = Number(today.slice(0, 4)) || new Date().getFullYear();
  const q = question.toLowerCase();
  // The query's own words, without the ones the subject already says ("export controls" twice).
  const sub = (id: string, ask: string, query: string): SubQuestion => {
    const own = new Set(s.toLowerCase().split(' '));
    const tail = query
      .slice(s.length)
      .split(' ')
      .filter((w) => w && !own.has(w.toLowerCase()));
    return {
      id,
      ask,
      query: [query.startsWith(s) ? s : query, ...(query.startsWith(s) ? tail : [])].join(' '),
    };
  };
  let subQuestions: SubQuestion[];
  if (/\bwhat if|what happens|would happen|cut|ban|blocked|halt|do to\b/.test(q))
    subQuestions = [
      sub('dependence', `How much of ${s} comes from the source at risk`, `${s} supply share`),
      sub('past-shock', `What happened the last time it was disrupted`, `${s} shortage impact`),
      sub('responses', `How buyers and producers responded`, `${s} alternative supply capacity`),
      sub('prices', `What prices did`, `${s} price spike`),
      sub('outlook', `What published analyses expect now`, `${s} supply risk outlook ${y}`),
    ];
  else if (/\bcompare|versus|\bvs\.?\b/.test(q))
    subQuestions = [
      sub('rules', `What each measure restricts and since when`, `${s} export controls timeline`),
      sub('trade', `What happened to trade volumes`, `${s} exports fell after controls`),
      sub('prices', `What happened to prices`, `${s} price after export controls`),
      sub(
        'responses',
        `How supply outside the restricting country responded`,
        `${s} new production outside China`,
      ),
      sub('outlook', `What analysts expect next`, `${s} export controls impact analysis ${y}`),
    ];
  else if (/\bwhen\b/.test(q))
    subQuestions = [
      sub('status', `Where the leading projects stand`, `${s} first projects status ${y}`),
      sub('licensing', `What licensing and regulators have decided`, `${s} licensing approval`),
      sub('costs', `What it costs and who pays`, `${s} cost estimate`),
      sub(
        'timelines',
        `What timelines developers and analysts publish`,
        `${s} commercial operation date`,
      ),
      sub('risks', `What has delayed or cancelled projects`, `${s} project delayed cancelled`),
    ];
  else
    subQuestions = [
      sub('supply', `Current global supply and who produces it`, `global ${s} supply producers`),
      sub('drivers', `Demand drivers by end use and their growth`, `${s} demand end use growth`),
      sub('risks', `Supply-side risks and responses`, `${s} supply shortage new capacity`),
      sub('prices', `Price history`, `${s} price history`),
      sub('forecasts', `Published forecasts and their assumptions`, `${s} market forecast ${y}`),
    ];
  return { subject: s, subQuestions, calls: [], by: 'code' };
}

/** What the planning call is told. The question is the user turn; nothing in it is an instruction. */
export function planPrompt(today: string): string {
  return [
    'You plan research for an analyst. Today is ' + today + '.',
    'Break the user question into 3 to 6 sub-questions an analyst would answer before giving a view: for a demand outlook, current global supply and who supplies it; demand drivers by end use and their growth; supply-side risks and responses; price history; published forecasts and their assumptions. For a "what if", the dependence, the last disruption and how it played out, responses, prices, current outlooks. For a "when", project status, licensing, costs, published timelines, delays.',
    'Give each a short id, the sub-question, and ONE web search query (specific: name the subject, the measure and a year where it helps).',
    `Optionally name corpus lookups from this list only: ${PLAN_TOOLS.join(', ')} — each with its arguments (resource, country, query, name, bottleneck, company as the tool takes them).`,
    'Reply with JSON only, no prose:',
    '{"subject":"neon","subQuestions":[{"id":"supply","ask":"…","query":"…"}],"tools":[{"name":"find_numbers","args":{"query":"neon"}}]}',
  ].join('\n');
}

/**
 * The plan: one model call, validated in code, under a time limit; the code
 * plan when it fails. Never throws and never streams to the reader.
 */
export async function planResearch(
  question: string,
  turn: ModelTurn,
  today: string,
  ms: number = PLAN_LIMITS.planMs,
): Promise<ResearchPlan> {
  const messages: ChatMessage[] = [
    { role: 'system', content: planPrompt(today) },
    { role: 'user', content: question },
  ];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      turn({ messages, onText: () => {} }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
    const parsed = result ? parsePlan(result.text) : null;
    return parsed ? { ...parsed, by: 'model' } : fallbackPlan(question, today);
  } catch {
    return fallbackPlan(question, today);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
