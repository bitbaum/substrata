/**
 * The review log keeps a conversation's turns together under a uuid
 * (lib/chat-review/log.ts). chatkit's ChatApp names its chats with its own
 * ids, so each is mapped to a uuid here — the same chat id, the same uuid,
 * on every turn and every thumb, with nothing to store. Not a secret and not
 * a security boundary: a stable label. Pure.
 */
function fnv(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** A chat id → a version-4-shaped uuid, deterministically. */
export function logIdFor(chatId: string): string {
  const hex = [0x811c9dc5, 0x01234567, 0x89abcdef, 0x0badf00d].map((s) => fnv(chatId, s)).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
