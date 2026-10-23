'use client';

import Link from 'next/link';
import type { RenderLink } from '@bitbaum/chatkit/react';

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
