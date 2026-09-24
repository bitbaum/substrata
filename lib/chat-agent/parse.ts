/** Reading a finished turn: its tool calls in either protocol, and its prose cleaned. */
import { parseTextToolCalls, stripToolCallLines } from '@bitbaum/ai-kit';
import { CHAT_TOOLS } from '../chat-tools/registry';

/**
 * Make the answer's links work.
 *
 * gpt-oss writes non-breaking hyphens (U+2011) inside paths, which turns
 * `/bottlenecks/euv-lithography-scanners` into a 404, and sometimes cites a
 * page as a bare `[/markets/asml]` rather than a link. Both are repaired here
 * rather than argued with in the prompt.
 */
export function tidyAnswer(text: string): string {
  return text.replace(/[\u2010\u2011]/g, '-').replace(/\[(\/[a-z0-9/_-]+)\](?!\()/gi, '[$1]($1)');
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
