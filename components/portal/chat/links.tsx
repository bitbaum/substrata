'use client';

import Link from 'next/link';
import type { RenderLink } from '@bitbaum/chatkit/react';
import type { Attachment } from '@bitbaum/chatkit';

/** Same-site links stay in the app (client navigation); everything else opens beside it. */
export const renderLink: RenderLink = ({ href, internal, className, children }) =>
  internal ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  );

/** Text files go into the question; pictures are not read here yet. */
export function withAttachments(text: string, attachments: Attachment[]): string {
  const files = attachments
    .filter((a): a is Extract<Attachment, { kind: 'text' }> => a.kind === 'text')
    .map((a) => `Attached ${a.name}:\n${a.content.slice(0, 2500)}`);
  return [text, ...files].filter((t) => t.trim()).join('\n\n');
}
