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
import { DEPENDENCY_TOOLS } from './dependencies';
import { EXPOSURE_TOOLS } from './exposure';
import { LEAD_TOOLS } from './leads';
import type { ToolEnv } from './ledger';
import { LIST_TOOLS } from './lists';
import { RECORD_TOOLS } from './records';
import type { Args, ChatTool } from './tool';
import { WEB_TOOLS } from './web';

/** Every tool, in the order the model is offered them. */
export const CHAT_TOOLS: readonly ChatTool[] = [
  ...RECORD_TOOLS,
  ...DEPENDENCY_TOOLS,
  ...EXPOSURE_TOOLS,
  ...LIST_TOOLS,
  ...LEAD_TOOLS,
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

const MAX_RESULT_CHARS = 3500;

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
  const args = parseArgs(rawArgs);
  const label = tool.label(args);
  env.ledger.trail.push(label);
  let out: unknown;
  try {
    out = await tool.run(args, env);
  } catch {
    out = { error: `${name} failed.` };
  }
  return { label, result: fitResult(out) };
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
