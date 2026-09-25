/** Reading a finished turn: its tool calls in either protocol, and its prose cleaned. */
import { parseTextToolCalls, stripToolCallLines } from '@bitbaum/ai-kit';
import { CHAT_TOOLS } from '../chat-tools/registry';
import { resolveByPath } from '../entities/registry';

/**
 * Make the answer's links work.
 *
 * gpt-oss writes non-breaking hyphens (U+2011) inside paths, which turns
 * `/bottlenecks/euv-lithography-scanners` into a 404, and sometimes cites a
 * page as a bare `[/markets/asml]` rather than a link. Both are repaired here
 * rather than argued with in the prompt.
 */
export function tidyAnswer(text: string): string {
  return citationLinks(text.replace(/[\u2010\u2011]/g, '-')).replace(
    /\[(\/[a-z0-9/_-]+)\](?!\()/gi,
    '[$1]($1)',
  );
}

/**
 * gpt-oss and Nemotron cite in their training format — `【/bottlenecks/x】`,
 * `【https://…】`, `【3†L1-L4】` — which renders as literal brackets and links
 * nowhere (seen live 2026-09-25). A site path becomes a link named after its
 * record, a URL a "source" link, `【W1】` the web marker the prompt asks for;
 * anything else is a marker pointing at nothing the reader can open, and goes.
 */
export function citationLinks(text: string): string {
  return text.replace(/[ \t]?【([^】\n]{1,300})】/g, (_, inner: string) => {
    const body = inner.split('†')[0].trim();
    if (/^\/[\w\-/?=&%.]*$/.test(body)) return ` ([${resolveByPath(body)?.name ?? body}](${body}))`;
    if (/^https?:\/\/\S+$/.test(body)) return ` ([source](${body}))`;
    if (/^W\d+$/i.test(body)) return ` [${body.toUpperCase()}]`;
    return '';
  });
}

/** A reasoning model's preamble, closed or (when the head was cut) only closed. */
export function stripThinking(text: string): string {
  const close = text.lastIndexOf('</think>');
  return (close === -1 ? text : text.slice(close + '</think>'.length)).trim();
}

export interface ToolRequest {
  name: string;
  args: string;
}

const toolNames = () => CHAT_TOOLS.map((t) => t.name);

/** Read a finished turn for calls in either protocol, and clean its prose. */
export function readTurn(
  text: string,
  native: { name: string; args: string }[],
  offered: boolean,
): { text: string; calls: ToolRequest[] } {
  const bare = stripThinking(text);
  if (!offered) return { text: bare, calls: [] };
  if (native.length) return { text: stripToolCallLines(bare).trim(), calls: native };
  const fromText = parseTextToolCalls(bare, toolNames()).map((c) => ({
    name: c.name,
    args: c.args,
  }));
  return { text: fromText.length ? stripToolCallLines(bare).trim() : bare, calls: fromText };
}

/** The call rendered back into the transcript in the protocol every link reads. */
export function renderCalls(calls: ToolRequest[]): string {
  return calls.map((c) => `TOOL: ${c.name}\nARGS: ${c.args || '{}'}`).join('\n\n');
}

export function safeArgs(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
