import type { Answer, StreamEvent } from './types';

/**
 * Read /api/chat's NDJSON stream: each event to `on`, the finished answer
 * returned. An `error` event throws its words — the reader sees them as they
 * are (the blind-model sentence included), never a generic failure.
 */
export async function readAnswerStream(
  response: Response,
  on: {
    status: (text: string) => void;
    tool: (label: string) => void;
    delta: (text: string) => void;
    reset: () => void;
  },
): Promise<Answer | null> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body.');
  const decoder = new TextDecoder();
  let buffer = '';
  let done: Answer | null = null;
  while (true) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === 'error') throw new Error(event.error || 'Unavailable.');
      if (event.type === 'status') on.status(event.text);
      if (event.type === 'tool') on.tool(event.label);
      if (event.type === 'delta') on.delta(event.text);
      // The model decided to look something up after all: what it had
      // started writing is withdrawn rather than left as an answer.
      if (event.type === 'reset') on.reset();
      if (event.type === 'done') done = event.data;
    }
  }
  return done;
}
