/**
 * Pictures and files a reader attaches to a question — a screenshot of a post
 * above all (the owner, 2026-10-27: "I wanted to ask Substrata about this, but
 * I wasn't able to … there was no way for me to attach the screenshots").
 *
 * Two rules, as in Heidi (lib/domain/chat/image.ts there), whose numbers
 * these are:
 *  1. Shrink in the BROWSER before upload (chatkit's `maxImageEdge`): a phone
 *     screenshot is several megabytes, a vision model reads a post just as
 *     well at 1024px, and the full-resolution picture never leaves the device.
 *  2. Validate on the SERVER anyway. The browser is not a security boundary.
 *
 * Pictures are never stored: not in the review log, not in a conversation,
 * not on the device past the tab that sends them. Pure: no DOM, no network.
 */

/** Pictures per message: the server's ceiling, which the composer mirrors. */
export const MAX_IMAGES = 3;
/** Longest edge after the in-browser shrink. Above this a vision model gains nothing. */
export const MAX_IMAGE_EDGE = 1024;
/** A generous ceiling for a shrunk JPEG; anything larger is not a screenshot. */
export const MAX_IMAGE_BYTES = 1_500_000;
/** What a message of only attachments says (the composer's attachmentOnlyText). */
export const ATTACHMENT_ONLY_TEXT = "What's your take on this?";

/** Characters of attached text files (a pasted post, a .txt, a .md, a .csv). */
export const MAX_ATTACHED_TEXT = 24_000;

/** The largest /api/chat body: three pictures as base64, the attached text and the history. */
export const CHAT_BODY_BYTES = Math.ceil((MAX_IMAGES * MAX_IMAGE_BYTES * 4) / 3) + 200_000;

export const ACCEPTED_IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export type ImageCheck = { ok: true; dataUrl: string } | { ok: false; reason: string };

/**
 * One data URL that claims to be a picture. Strict about the prefix: a
 * `data:text/html` URL passed to a vendor is not dangerous to us, but anything
 * shaped like a string would mean not knowing what we are paying to send.
 */
export function readImage(raw: unknown): ImageCheck {
  if (typeof raw !== 'string' || !raw) return { ok: false, reason: 'not a string' };
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(raw);
  if (!match) return { ok: false, reason: 'not a base64 data URL' };
  const [, mime, payload] = match;
  if (!(ACCEPTED_IMAGES as readonly string[]).includes(mime.toLowerCase()))
    return { ok: false, reason: `unsupported type ${mime}` };
  // Four characters per three bytes: close enough to refuse the outrageous without decoding.
  if (Math.floor((payload.length * 3) / 4) > MAX_IMAGE_BYTES)
    return { ok: false, reason: 'image is too large' };
  return { ok: true, dataUrl: raw };
}

export type ImagesCheck = { ok: true; images: string[] } | { ok: false; error: string };

/** The `images` field of a request: absent is none; anything wrong refuses the request, in words. */
export function readImages(raw: unknown): ImagesCheck {
  if (raw === undefined || raw === null) return { ok: true, images: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'Pictures must be a list.' };
  if (raw.length > MAX_IMAGES)
    return { ok: false, error: `Attach at most ${MAX_IMAGES} pictures to one question.` };
  const images: string[] = [];
  for (const item of raw) {
    const check = readImage(item);
    if (!check.ok)
      return {
        ok: false,
        error:
          check.reason === 'image is too large'
            ? 'A picture is too large. Attach a screenshot under 1.5 MB.'
            : 'A picture could not be read. Attach a PNG, JPEG, WebP or GIF.',
      };
    images.push(check.dataUrl);
  }
  return { ok: true, images };
}

/** The `attached` field: text files the reader attached, joined, bounded, or '' when none. */
export function readAttachedText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, MAX_ATTACHED_TEXT);
}

/** chatkit's wire attachment, as far as this file needs it (no import: this file is pure). */
export type WireAttachment =
  | { kind: 'text'; name: string; content: string }
  | { kind: 'image'; name: string; mimeType: string; dataBase64: string };

/** What the composer staged → the request's pictures, attached text and the names to show. */
export function fromWire(attachments: readonly WireAttachment[]): {
  images: string[];
  attached: string;
  names: string[];
} {
  const images: string[] = [];
  const texts: string[] = [];
  for (const a of attachments) {
    if (a.kind === 'image') images.push(`data:${a.mimeType};base64,${a.dataBase64}`);
    else texts.push(`--- ${a.name} ---\n${a.content}`);
  }
  return {
    images: images.slice(0, MAX_IMAGES),
    attached: texts.join('\n\n').slice(0, MAX_ATTACHED_TEXT),
    names: attachments.map((a) => a.name),
  };
}
