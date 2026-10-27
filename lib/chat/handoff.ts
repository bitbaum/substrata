/**
 * The home page's box and /chat are frames around ONE chat: the home box does
 * not answer; it hands its message — words AND attachments — to /chat, which
 * sends it at once. The attachments travel through this tab's session store
 * under an id (`/chat?send=<id>`), read once and deleted: a picture never
 * reaches the server's logs or a URL. /chat gives it to chatkit's ChatApp as
 * its `initialMessage`, which sends it once, as a new chat.
 *
 * A storage failure (a private window, a full quota) never blocks: a message
 * without attachments still goes by `/chat?q=`, and one with attachments is
 * kept in the box with a sentence. Which chat is open, and the Chats list,
 * are chatkit's ChatApp's, not this file's.
 */
import { MAX_IMAGES, type WireAttachment } from './image';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SEND_PREFIX = 'substrata-ask-send:';
/** The query parameter /chat reads a handed-over message from. */
export const SEND_PARAM = 'send';

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

/** A handed-over attachment back as the File the paperclip would have picked. */
export function fileOf(a: WireAttachment): File {
  if (a.kind === 'text') return new File([a.content], a.name, { type: 'text/plain' });
  const bytes = Uint8Array.from(atob(a.dataBase64), (c) => c.charCodeAt(0));
  return new File([bytes], a.name, { type: a.mimeType });
}

/** What was taken per id this page: StrictMode's rehearsal render reads the same message again. */
const taken = new Map<string, PendingSend | null>();

/**
 * The message the page at `href` was handed (`?send=<id>`), with its
 * attachments as Files — or null. Read once per page load: the store's copy
 * is deleted, so a reload never sends it again.
 */
export function handedOver(
  href: string,
  storage: StorageLike | null = session(),
): { text: string; attachments: File[] } | null {
  let id: string | null = null;
  try {
    id = new URL(href).searchParams.get(SEND_PARAM);
  } catch {
    return null;
  }
  if (!id) return null;
  if (!taken.has(id)) taken.set(id, takePending(id, storage));
  const message = taken.get(id);
  return message ? { text: message.text, attachments: message.attachments.map(fileOf) } : null;
}

/** Where a handed-over message is opened. */
export function sendHref(id: string): string {
  return `/chat?${SEND_PARAM}=${encodeURIComponent(id)}`;
}
