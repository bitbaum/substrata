/**
 * The home page's box and /chat are frames around ONE chat: the home box does
 * not answer; it hands its message — words AND attachments — to /chat, which
 * sends it at once. The attachments travel through this tab's session store
 * under an id (`/chat?send=<id>`), read once and deleted: a picture never
 * reaches localStorage, the server's logs or a URL. The words in the box are
 * shared too (the draft), so a half-typed question follows the reader from
 * the panel to /chat.
 *
 * Storage failures (a private window, a full quota) never block: the draft
 * is simply not remembered, and a message without attachments still goes by
 * `/chat?q=`. Which conversation is open, and the Chats list, are chatkit's
 * conversation store's (ChatApp), not this file's.
 */
import { MAX_IMAGES, type WireAttachment } from './image';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const DRAFT_KEY = 'substrata-ask-draft';
const SEND_PREFIX = 'substrata-ask-send:';
/** The query parameter /chat reads a handed-over message from. */
export const SEND_PARAM = 'send';

const local = (): StorageLike | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};
const session = (): StorageLike | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

function get(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function set(storage: StorageLike | null, key: string, value: string | null): boolean {
  try {
    if (!storage) return false;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(storage: StorageLike | null = local()): string {
  return (get(storage, DRAFT_KEY) ?? '').slice(0, 4000);
}

export function saveDraft(text: string, storage: StorageLike | null = local()): void {
  set(storage, DRAFT_KEY, text ? text.slice(0, 4000) : null);
}

/** A message handed from one surface to /chat. */
export interface PendingSend {
  text: string;
  attachments: WireAttachment[];
}

function isWire(a: unknown): a is WireAttachment {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  return (
    typeof x.name === 'string' &&
    ((x.kind === 'text' && typeof x.content === 'string') ||
      (x.kind === 'image' && typeof x.mimeType === 'string' && typeof x.dataBase64 === 'string'))
  );
}

/**
 * Hand a message to /chat. Returns the id to put in the URL, or null when the
 * tab's store refused it (then the caller sends the words alone, and says so).
 */
export function savePending(
  pending: PendingSend,
  storage: StorageLike | null = session(),
  id: string = crypto.randomUUID(),
): string | null {
  const value: PendingSend = {
    text: pending.text.slice(0, 4000),
    attachments: pending.attachments.filter(isWire).slice(0, MAX_IMAGES + 2),
  };
  return set(storage, SEND_PREFIX + id, JSON.stringify(value)) ? id : null;
}

/** Read a handed-over message once: it is deleted as it is read, so a reload never sends it twice. */
export function takePending(
  id: unknown,
  storage: StorageLike | null = session(),
): PendingSend | null {
  if (typeof id !== 'string' || !/^[a-z0-9-]{8,64}$/i.test(id)) return null;
  const raw = get(storage, SEND_PREFIX + id);
  set(storage, SEND_PREFIX + id, null);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PendingSend>;
    if (typeof v.text !== 'string' || !Array.isArray(v.attachments)) return null;
    return { text: v.text, attachments: v.attachments.filter(isWire) };
  } catch {
    return null;
  }
}

/** Where a handed-over message is opened. */
export function sendHref(id: string): string {
  return `/chat?${SEND_PARAM}=${encodeURIComponent(id)}`;
}
