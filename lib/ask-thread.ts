/**
 * The Ask panel's thread, handed to /chat when the reader taps Expand.
 *
 * The panel is a sheet over a page; /chat is the same conversation with the
 * whole screen. Nothing may be lost between the two, so the thread travels
 * the way a question from the home page does (`/chat?q=`): into the tab's
 * session store under an id, and the URL carries only that id. A reload of
 * /chat finds the thread again in the same tab; another tab, or a shared
 * link, opens an empty chat — the thread was the reader's, not a page.
 */
import type { Turn } from '@/components/portal/chat/types';

/** The query parameter /chat reads: `/chat?thread=<id>`. */
export const THREAD_PARAM = 'thread';
const PREFIX = 'substrata-ask-thread:';
/** Keep the handoff well under a tab's storage quota: the turns, not a library. */
const MAX_TURNS = 40;

export interface ThreadHandoff {
  /** The handoff id (the URL carries it). */
  id: string;
  /** The server's conversation id, so /chat continues the same logged thread. */
  conversationId: string;
  topic: string;
  /** The page the panel was opened from, so "it" still resolves there. */
  onPath?: string;
  turns: Turn[];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function threadKey(id: string): string {
  return `${PREFIX}${id}`;
}

export function chatHref(id: string): string {
  return `/chat?${THREAD_PARAM}=${encodeURIComponent(id)}`;
}

/** An id is what we minted: letters, digits and dashes, never a path or a key. */
export function isThreadId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]{8,64}$/i.test(value);
}

function isTurn(value: unknown): value is Turn {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    (t.role === 'user' || t.role === 'assistant') &&
    typeof t.content === 'string'
  );
}

/** Only a handoff we wrote comes back: anything else in the store is ignored. */
export function isHandoff(value: unknown): value is ThreadHandoff {
  if (!value || typeof value !== 'object') return false;
  const h = value as Record<string, unknown>;
  return (
    isThreadId(h.id) &&
    typeof h.conversationId === 'string' &&
    typeof h.topic === 'string' &&
    (h.onPath === undefined || typeof h.onPath === 'string') &&
    Array.isArray(h.turns) &&
    h.turns.every(isTurn)
  );
}

export function saveThread(handoff: ThreadHandoff, storage: StorageLike = sessionStorage): void {
  const turns = handoff.turns.slice(-MAX_TURNS);
  try {
    storage.setItem(threadKey(handoff.id), JSON.stringify({ ...handoff, turns }));
  } catch {
    // A full or blocked store: /chat opens empty, and the panel still has the thread.
  }
}

export function loadThread(
  id: string,
  storage: StorageLike = sessionStorage,
): ThreadHandoff | null {
  if (!isThreadId(id)) return null;
  try {
    const raw = storage.getItem(threadKey(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isHandoff(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
