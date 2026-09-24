'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Site links stay in the app; outside links open apart and carry no referrer. */
const MARKDOWN_COMPONENTS = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
    href?.startsWith('/') || href?.startsWith('#') ? (
      <Link href={href}>{children}</Link>
    ) : href && /^https?:\/\//.test(href) ? (
      <a href={href} target="_blank" rel="noreferrer nofollow">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        disallowedElements={['img', 'iframe', 'script', 'style']}
        components={MARKDOWN_COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
