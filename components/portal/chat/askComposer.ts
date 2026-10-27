/**
 * THE composer's configuration, for the home box, the Ask panel and /chat
 * (one shape per kind): "+" for Camera · Photos · Files with Heidi's picture
 * limits (shrunk to 1024px in the browser before staging), microphone, send.
 * ChatApp takes it as its `composer`; the home box spreads it into chatkit's
 * `Composer`. Pictures and text files only — chatkit refuses a PDF with a
 * sentence, which is the honest limit (/api/chat reads no PDF).
 */
import type { ComposerProps } from '@bitbaum/chatkit/react';
import {
  ATTACHMENT_ONLY_TEXT,
  MAX_ATTACHED_TEXT,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  MAX_IMAGES,
} from '@/lib/chat/image';

export const ASK_PLACEHOLDER = 'Ask anything, or add a screenshot…';
export const ATTACH_LABEL = 'Add a screenshot or a file';

export function askComposerProps(): Partial<ComposerProps> & {
  placeholder: string;
  attachmentOnlyText: string;
} {
  return {
    placeholder: ASK_PLACEHOLDER,
    ariaLabel: 'Ask about a bottleneck, a company, a post you saw…',
    voice: { transcribeUrl: '/api/transcribe' },
    attach: {
      maxFiles: MAX_IMAGES,
      maxImageEdge: MAX_IMAGE_EDGE,
      maxImageBytes: MAX_IMAGE_BYTES,
      maxTextChars: MAX_ATTACHED_TEXT,
    },
    // A screenshot alone is the commonest question there is.
    attachmentOnlyText: ATTACHMENT_ONLY_TEXT,
    labels: { send: 'Ask', attach: ATTACH_LABEL, attachMenu: { title: 'Add to your question' } },
  };
}

/**
 * A chat that began with only a screenshot is named after the answer's first
 * sentence — "What's your take on this?" would name every such chat alike.
 * Any other chat keeps the title its first message gave it.
 */
export function titleAfterAnswer({
  text,
  answer,
}: {
  text: string;
  answer: string;
}): string | null {
  if (text.trim() !== ATTACHMENT_ONLY_TEXT) return null;
  const first = answer
    .replace(/\s*\[(W?\d+)\]/g, '')
    .split('\n')
    .find((l) => l.trim() && !l.startsWith('#'))
    ?.split(/(?<=[.!?])\s/)[0]
    ?.replace(/[*_`]/g, '')
    .trim();
  if (!first) return null;
  return first.length > 48 ? `${first.slice(0, 47).replace(/\s+\S*$/, '')}…` : first;
}
