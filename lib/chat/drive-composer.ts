/**
 * Send a message through chatkit's composer the way a person would: the
 * words typed, the files picked, Send pressed.
 *
 * Why it exists: Substrata's chat is chatkit's `ChatApp`, which owns sending,
 * the list and the queue — and (0.18.0) offers no way for the page to send a
 * message itself. Three messages arrive from elsewhere and must still be
 * sent at once: a "Check this" from a figure on the page, a starter question
 * (`/chat?q=`), and what the home box handed over with its pictures
 * (`/chat?send=`, lib/chat/handoff.ts). Going through the composer's own
 * file picker and Send keeps every rule chatkit applies (the picture shrink, the
 * size notes, the queue) in force. The day chatkit takes a `send` handle,
 * this file goes. Browser only.
 */
import type { WireAttachment } from './image';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

async function until<T>(read: () => T | null | undefined | false, ms = 6000): Promise<T | null> {
  for (const end = Date.now() + ms; Date.now() < end; await tick()) {
    const v = read();
    if (v) return v;
  }
  return null;
}

/** A handed-over attachment back as the File the composer takes. */
export function fileOf(a: WireAttachment): File {
  if (a.kind === 'text') return new File([a.content], a.name, { type: 'text/plain' });
  const bytes = Uint8Array.from(atob(a.dataBase64), (c) => c.charCodeAt(0));
  return new File([bytes], a.name, { type: a.mimeType });
}

/**
 * Type `text`, pick `attachments`, press Send — in the composer under
 * `root`. Resolves false when the composer never became ready to send.
 */
export async function sendThroughComposer(
  root: ParentNode,
  text: string,
  attachments: readonly WireAttachment[] = [],
): Promise<boolean> {
  const box = await until(() => root.querySelector<HTMLTextAreaElement>('.ck-composer textarea'));
  if (!box) return false;
  if (attachments.length) {
    // The Files source takes any file, as the reader's own pick would.
    const input = root.querySelector<HTMLInputElement>(
      '.ck-composer input[data-ck-source="files"]',
    );
    if (!input) return false;
    const data = new DataTransfer();
    for (const a of attachments) data.items.add(fileOf(a));
    input.files = data.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const staged = await until(
      () =>
        root.querySelectorAll('.ck-composer [aria-label^="Remove"]').length >= attachments.length,
    );
    if (!staged) return false;
  }
  // React reads a field's value through its own setter: set it the native way, then say so.
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(box, text);
  box.dispatchEvent(new Event('input', { bubbles: true }));
  const send = await until(() => {
    const b = root.querySelector<HTMLButtonElement>('.ck-composer .ck-send:not(.ck-send-stop)');
    return b && !b.disabled ? b : null;
  });
  if (!send) return false;
  send.click();
  return true;
}
