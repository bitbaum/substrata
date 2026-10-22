/**
 * The Ask log: one row per turn, written as the agent loop ends.
 *
 * The owner tried Ask and got "nothing in our database" with no way forward,
 * and nobody knew until he said so. From here every question and answer is
 * kept — with the status lines the reader watched while it was written and
 * the page it was asked from — so Loki's nightly judge (chatkit 0.14,
 * `reviewPrompt`) can read a day of conversations and file what Substrata
 * should have given. Nothing names the reader: the thread id is a random
 * uuid the browser minted, the turn ids are random too.
 *
 * Writing never fails an answer: the log is a side effect of the stream and
 * every failure is swallowed, as `recordAskTiming` does.
 */
import { randomUUID } from 'node:crypto';
import type { AgentEvent } from '../chat-agent/answer';
import { database } from '../db';

export const MAX_STEPS = 40;
export const MAX_CONTENT = 20_000;

export interface TurnRow {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  steps: string[];
  surface: string;
  failed: boolean;
}

export type TurnWriter = (row: TurnRow) => Promise<void>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A uuid the client minted, or none: anything else is not a thread id. */
export function uuidOrNull(value: unknown): string | null {
  return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;
}

export async function writeTurn(row: TurnRow): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await database().query(
      `INSERT INTO chat_turns(id, conversation_id, role, content, steps, surface, failed)
       VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.conversationId,
        row.role,
        row.content.slice(0, MAX_CONTENT),
        JSON.stringify(row.steps.slice(0, MAX_STEPS)),
        row.surface.slice(0, 300),
        row.failed,
      ],
    );
  } catch {
    // The table may not exist yet on a fresh box; the answer still stands.
  }
}

/**
 * Watches one question's stream and writes its two rows: the question at
 * once, the answer (or the failure, with what it had said) when the loop
 * ends. `observe` is called with every event the route sends.
 */
export function chatTurnLog(input: {
  conversationId: string | null;
  messageId: string | null;
  question: string;
  surface: string | undefined;
  write?: TurnWriter;
}) {
  const write = input.write ?? writeTurn;
  const conversationId = input.conversationId ?? randomUUID();
  const messageId = input.messageId ?? randomUUID();
  const surface = input.surface ?? '/chat';
  const steps: string[] = [];
  let closed = false;
  void write({
    id: randomUUID(),
    conversationId,
    role: 'user',
    content: input.question,
    steps: [],
    surface,
    failed: false,
  });
  return {
    conversationId,
    messageId,
    observe(event: AgentEvent) {
      if (closed) return;
      if (event.type === 'status' || event.type === 'tool') {
        const label = event.type === 'status' ? event.text : event.label;
        if (steps.length < MAX_STEPS && steps.at(-1) !== label) steps.push(label);
        return;
      }
      if (event.type !== 'done' && event.type !== 'error') return;
      closed = true;
      const failed = event.type === 'error' || Boolean(event.data.degraded);
      void write({
        id: messageId,
        conversationId,
        role: 'assistant',
        content: event.type === 'done' ? event.data.answer : event.error,
        steps,
        surface,
        failed,
      });
    },
  };
}
