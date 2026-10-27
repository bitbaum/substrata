/**
 * What the assistant can look up, as real functions.
 *
 * The first assistant guessed what a question was about from its words, pulled
 * the ten documents that shared the most of them, and asked a small model to
 * answer from whatever came back. That is keyword-probing: "who makes the
 * thing on this page" and "what changed this week on my rails" have no words in
 * common with the rows that answer them, so the model was handed the wrong
 * rows and then (correctly) said it could not answer.
 *
 * Here the model decides what it needs and asks for it by name — a bottleneck,
 * a company, the accepted events, the sweep's unread leads, the open web — and
 * every function returns structured rows with their evidence state spelled out
 * on each one. The honesty rules travel WITH the data rather than living only
 * in the prompt: a producer row says "Unverified lead", a sweep hit says
 * "UNREVIEWED sweep lead", a web passage says "unchecked web page".
 *
 * Every tool result is data, never instructions; the web one especially.
 * Results are kept short because the free tier pays for every token of them.
 */
import { COVERAGE_TOOLS } from './coverage';
import { DEPENDENCY_TOOLS } from './dependencies';
import { EXPOSURE_TOOLS } from './exposure';
import { OWNERSHIP_TOOLS } from './ownership';
import { MARKET_TOOLS } from './market';
import { FILING_TOOLS } from './filings';
import { GRAPH_TOOLS } from './graph';
import { JOB_TOOLS } from './jobs';
import { NUMBER_TOOLS } from './numbers';
import { POLICY_TOOLS } from './policy';
import { SCIENCE_TOOLS } from './science';
import { WRITING_TOOLS } from './writing';
import { LEAD_TOOLS } from './leads';
import type { ToolEnv } from './ledger';
import { isAnswerTable } from '../chat/answer-table';
import { isAnswerChart } from '../chat/answer-chart';
import { LIST_TOOLS } from './lists';
import { RECORD_TOOLS } from './records';
import { PRODUCER_TOOLS } from './producers';
import { RESOURCE_TOOLS } from './resources';
import { SCENARIO_TOOLS } from './scenario';
import { withAliases, type Args, type ChatTool } from './tool';
import { TRADE_RULE_TOOLS } from './trade-rules';
import { UNIVERSE_TOOLS } from './universe';
import { WEB_TOOLS } from './web';

/** Every tool, in the order the model is offered them. */
export const CHAT_TOOLS: readonly ChatTool[] = [
  ...RECORD_TOOLS,
  ...DEPENDENCY_TOOLS,
  ...EXPOSURE_TOOLS,
  ...OWNERSHIP_TOOLS,
  ...MARKET_TOOLS,
  // Why a company is or is not covered: the written admission rule.
  ...UNIVERSE_TOOLS,
  ...RESOURCE_TOOLS,
  ...PRODUCER_TOOLS,
  ...TRADE_RULE_TOOLS,
  // Rung 3 of the answer ladder: related_to and how_connected over lib/graph.
  // related_to's non-empty `owners` list covers the owners link in
  // lib/chat-agent/ladder.ts; a `buyers` list would cover the buyers link.
  ...GRAPH_TOOLS,
  ...COVERAGE_TOOLS,
  ...SCENARIO_TOOLS,
  ...LIST_TOOLS,
  ...NUMBER_TOOLS,
  ...SCIENCE_TOOLS,
  ...POLICY_TOOLS,
  ...FILING_TOOLS,
  ...WRITING_TOOLS,
  ...LEAD_TOOLS,
  ...JOB_TOOLS,
  ...WEB_TOOLS,
];

/** The tools this deployment can actually run, in the OpenAI shape every provider speaks. */
export function toolDefinitions(env: ToolEnv) {
  return CHAT_TOOLS.filter((t) => !t.available || t.available(env)).map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/** Parse a model's raw JSON argument string. A malformed one becomes `{}`, never a throw. */
export function parseArgs(raw: string | Record<string, unknown> | undefined): Args {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Args) : {};
  } catch {
    return {};
  }
}

// Two results plus the prompt stay well under a free model's per-minute token
// window. A tool whose rows are the answer (get_bottleneck) sets its own.
const MAX_RESULT_CHARS = 4500;

/**
 * Run one call and return what the model reads back.
 *
 * Never throws: an unknown tool or a failing lookup is a result the model can
 * reason about ("that is not in the corpus"), not an outage of the answer.
 */
export async function runTool(
  name: string,
  rawArgs: string | Record<string, unknown> | undefined,
  env: ToolEnv,
): Promise<{ label: string; result: string }> {
  const tool = CHAT_TOOLS.find((t) => t.name === name && (!t.available || t.available(env)));
  if (!tool) return { label: name, result: JSON.stringify({ error: `No tool called ${name}.` }) };
  const args = withAliases(tool.parameters, parseArgs(rawArgs));
  const label = tool.label(args);
  env.ledger.trail.push(label);
  let out: unknown;
  try {
    out = await tool.run(args, env);
  } catch {
    out = { error: `${name} failed.` };
  }
  return { label, result: fitResult(routeTable(out, env), tool.budget) };
}

/**
 * A result's `table` and `chart` go to the answer, not to the model: the reader
 * gets them drawn under the prose (lib/chat/answer-table.ts, answer-chart.ts),
 * and the model, which has the same figures in the result, is spared paying
 * for them twice.
 */
function routeTable(out: unknown, env: ToolEnv): unknown {
  if (!out || typeof out !== 'object' || !('table' in out || 'chart' in out)) return out;
  const { table, chart, ...rest } = out as { table?: unknown; chart?: unknown };
  if (isAnswerTable(table) && !env.ledger.tables.some((t) => t.id === table.id))
    env.ledger.tables.push(table);
  if (isAnswerChart(chart) && !env.ledger.charts.some((c) => c.id === chart.id))
    env.ledger.charts.push(chart);
  return {
    ...rest,
    ...(chart ? { chart_shown: 'The reader sees this chart under your answer.' } : {}),
  };
}

/** Halve every long list, deep. */
function shrink(value: unknown): unknown {
  if (Array.isArray(value))
    return value.slice(0, Math.max(2, Math.ceil(value.length / 2))).map(shrink);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shrink(v)]));
  return value;
}

/**
 * Serialise a result within budget and still valid JSON.
 *
 * Cutting the string at a length hands the model half an object; halving the
 * lists keeps the head of every list (they are ordered most-relevant first)
 * and says that more exists.
 */
export function fitResult(out: unknown, max = MAX_RESULT_CHARS): string {
  let value = out;
  let text = JSON.stringify(value);
  for (let i = 0; i < 4 && text.length > max; i++) {
    value = shrink(value);
    text = JSON.stringify(
      value && typeof value === 'object' && !Array.isArray(value)
        ? { ...value, truncated: 'Some list entries were left out for length; ask for fewer.' }
        : value,
    );
  }
  return text.length > max ? `${text.slice(0, max)}… [truncated]` : text;
}
