/**
 * The day's conversations in chatkit's `ChatTranscript` shape, for Loki's
 * nightly judge (`GET /api/chat/review-export`).
 *
 * Bounded on every axis — at most 50 conversations, 30 turns each, 4,000
 * characters a turn — because the reader of this export is a model with a
 * context window, not a person with a scrollbar. Ids are the random ones
 * the log already holds; no row here can name a reader.
 */
import { timingSafeEqual } from 'node:crypto';
import type { AnswerFeedback, ChatTranscript, ChatTranscriptTurn } from '@bitbaum/chatkit';
import { database } from '../db';

export const MAX_CONVERSATIONS = 50;
export const MAX_TURNS = 30;
export const MAX_TURN_CHARS = 4000;
export const DEFAULT_WINDOW_HOURS = 24;

/** `Authorization: Bearer <token>` against the configured token, in constant time. */
export function bearerMatches(header: string | null, token: string | undefined): boolean {
  if (!token || !header) return false;
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ''), 'utf8');
  const want = Buffer.from(token, 'utf8');
  return given.length === want.length && timingSafeEqual(given, want);
}

/** `since` from the query, or the default window; `limit` clamped to the cap. */
export function exportWindow(params: URLSearchParams): { since: Date; limit: number } {
  const raw = params.get('since');
  const parsed = raw ? new Date(raw) : null;
  const since =
    parsed && !Number.isNaN(parsed.getTime())
      ? parsed
      : new Date(Date.now() - DEFAULT_WINDOW_HOURS * 3_600_000);
  const limitRaw = Number(params.get('limit'));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), MAX_CONVERSATIONS)
      : MAX_CONVERSATIONS;
  return { since, limit };
}

export interface StoredTurn {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  steps: unknown;
  surface: string;
  failed: boolean;
  created_at: Date | string;
}

export interface StoredFeedback {
  conversation_id: string;
  message_id: string;
  verdict: 'up' | 'down';
  reason: string | null;
  text: string | null;
}

const iso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString();

/**
 * Group rows into transcripts: newest conversation first, each with its last
 * `MAX_TURNS` turns in order and the thumbs it received.
 */
export function transcriptsOf(turns: StoredTurn[], feedback: StoredFeedback[]): ChatTranscript[] {
  const byConversation = new Map<string, StoredTurn[]>();
  for (const t of turns) {
    const list = byConversation.get(t.conversation_id) ?? [];
    list.push(t);
    byConversation.set(t.conversation_id, list);
  }
  const thumbs = new Map<string, AnswerFeedback[]>();
  for (const f of feedback) {
    const list = thumbs.get(f.conversation_id) ?? [];
    list.push({
      messageId: f.message_id,
      verdict: f.verdict,
      ...(f.reason ? { reason: f.reason as AnswerFeedback['reason'] } : {}),
      ...(f.text ? { text: f.text } : {}),
    });
    thumbs.set(f.conversation_id, list);
  }
  const out: ChatTranscript[] = [];
  for (const [id, rows] of byConversation) {
    const ordered = [...rows].sort((a, b) => iso(a.created_at).localeCompare(iso(b.created_at)));
    const kept = ordered.slice(-MAX_TURNS);
    const transcriptTurns: ChatTranscriptTurn[] = kept.map((t) => ({
      id: t.id,
      role: t.role,
      content: t.content.slice(0, MAX_TURN_CHARS),
      ...(Array.isArray(t.steps) && t.steps.length
        ? { steps: t.steps.filter((s): s is string => typeof s === 'string') }
        : {}),
      ...(t.failed ? { failed: true } : {}),
    }));
    const last = ordered.at(-1)!;
    out.push({
      id,
      at: iso(last.created_at),
      surface: last.surface,
      turns: transcriptTurns,
      ...(thumbs.has(id) ? { feedback: thumbs.get(id) } : {}),
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_CONVERSATIONS);
}

/** Conversations with a turn since `since`, newest first, at most `limit`, with their thumbs. */
export async function readTranscripts(since: Date, limit: number): Promise<ChatTranscript[]> {
  const db = database();
  const conversations = await db.query<{ conversation_id: string }>(
    `SELECT conversation_id FROM chat_turns
      GROUP BY conversation_id HAVING max(created_at) > $1
      ORDER BY max(created_at) DESC LIMIT $2`,
    [since, Math.min(limit, MAX_CONVERSATIONS)],
  );
  const ids = conversations.rows.map((r) => r.conversation_id);
  if (!ids.length) return [];
  const [turns, feedback] = await Promise.all([
    db.query<StoredTurn>(
      `SELECT id, conversation_id, role, content, steps, surface, failed, created_at
         FROM chat_turns WHERE conversation_id = ANY($1::uuid[]) ORDER BY created_at`,
      [ids],
    ),
    db.query<StoredFeedback>(
      `SELECT conversation_id, message_id, verdict, reason, text
         FROM chat_feedback WHERE conversation_id = ANY($1::uuid[]) ORDER BY created_at`,
      [ids],
    ),
  ]);
  return transcriptsOf(turns.rows, feedback.rows);
}
