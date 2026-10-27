'use client';

import { useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { Composer } from '@bitbaum/chatkit/react';
import { loadDraft, saveDraft } from '@/lib/chat/handoff';
import {
  ATTACHMENT_ONLY_TEXT,
  MAX_ATTACHED_TEXT,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  MAX_IMAGES,
  type WireAttachment,
} from '@/lib/chat/image';

const noop = () => () => {};
/** False in the server render and the hydrating one, true after: the device can be read. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export const ASK_PLACEHOLDER = 'Ask anything, or add a screenshot…';

/**
 * THE box, on the home page, in the Ask panel and on /chat — one
 * configuration (one shape per kind): "+" for Camera · Photos · Files,
 * microphone, send. chatkit draws the staged thumbnails (each with Remove)
 * above the words, takes a pasted or dropped screenshot, shrinks a picture
 * to 1024px in the browser before it is staged, and keeps Send live while a
 * turn runs (`queue`). The words in it are shared by the three surfaces
 * (lib/chat/handoff.ts), so a half-typed question follows the reader.
 *
 * Pictures and text files only: chatkit's composer refuses a PDF with a
 * sentence ("attach an image or a text file"), and that is the honest limit.
 */
export function AskComposer({
  onSend,
  sending = false,
  onStop,
  inputRef,
  tools,
  density = 'compact',
  autoFocus,
}: {
  onSend: (text: string, attachments: WireAttachment[]) => boolean | Promise<boolean>;
  sending?: boolean;
  onStop?: () => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  tools?: ReactNode;
  density?: 'compact' | 'comfortable';
  autoFocus?: boolean;
}) {
  // The shared draft, once the device can be read (the server render has none):
  // the box is drawn again then, holding it.
  const hydrated = useHydrated();
  return (
    <Composer
      key={hydrated ? 'device' : 'server'}
      inputRef={inputRef}
      defaultValue={hydrated ? loadDraft() : ''}
      onValueChange={saveDraft}
      ariaLabel="Ask about a bottleneck, a company, a post you saw…"
      // Returned, not dropped: a question that was not sent stays in the box.
      onSend={async (text, attachments) => {
        const sent = await onSend(text, attachments as WireAttachment[]);
        if (sent) saveDraft('');
        return sent;
      }}
      placeholder={ASK_PLACEHOLDER}
      sending={sending}
      onStop={onStop}
      queue={Boolean(onStop)}
      density={density}
      autoFocus={autoFocus}
      voice={{ transcribeUrl: '/api/transcribe' }}
      attach={{
        maxFiles: MAX_IMAGES,
        maxImageEdge: MAX_IMAGE_EDGE,
        maxImageBytes: MAX_IMAGE_BYTES,
        maxTextChars: MAX_ATTACHED_TEXT,
      }}
      // A screenshot alone is the commonest question there is.
      attachmentOnlyText={ATTACHMENT_ONLY_TEXT}
      labels={{
        send: 'Ask',
        attach: 'Add a screenshot or a file',
        queue: 'Queue a message…',
        attachMenu: { title: 'Add to your question' },
      }}
      tools={tools}
    />
  );
}
