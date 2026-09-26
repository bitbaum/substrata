'use client';

import { useState } from 'react';

/**
 * Share this view: a button that copies the page's own URL, with the URL shown
 * beside it so it can also be read or selected by hand. The URL is the state
 * (every tool that uses this keeps its choices in the query string).
 */
export function CopyLink({ href, label = 'Copy link' }: { href: string; label?: string }) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  async function copy() {
    const url = new URL(href, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied('yes');
    } catch {
      setCopied('no');
    }
  }
  return (
    <p className="copy-link">
      <button type="button" className="research-button-ghost" onClick={() => void copy()}>
        {copied === 'yes' ? 'Copied' : label}
      </button>
      <code>{href}</code>
      <span role="status">{copied === 'no' ? 'Copy failed: select the link instead.' : ''}</span>
    </p>
  );
}
