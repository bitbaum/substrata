/**
 * A web page cited in an answer, shown as a source chip linked to the page.
 *
 * The model cites a passage it read as `[W2]`. chatkit draws `[F#]`/`[D#]`
 * handles as chips with a sources row under the answer (and a "Sources" sheet
 * on a phone), and drops a handle it has no entry for. So, for display only,
 * each `[W#]` the answer cites becomes a `[D#]` handle whose entry names the
 * page's site, its title and date, and that Substrata has not checked it —
 * the corpus-vs-web distinction stays visible claim by claim: corpus claims
 * link to site pages, web claims to the page they came from. `[F#]` is never
 * used: it means a corpus row someone accepted.
 */
import type { CitationMap } from '@bitbaum/chatkit/react';

import { domainOf } from '../chat-web-passages';

/** The fields of a web page read for an answer that a chip needs. */
interface WebPage {
  title: string;
  url: string;
  published?: string;
}

export function webCitations(
  content: string,
  web: readonly WebPage[] | undefined,
): { content: string; citations?: CitationMap } {
  if (!web?.length || !/\[W\d+/.test(content)) return { content };
  const citations: CitationMap = {};
  // "[W1]", "[W1, W3]" and "[W1][W2]" all become chatkit handles.
  const text = content.replace(/\[(W\d+(?:,\s*W\d+)*)\]/g, (whole, inner: string) => {
    const ids = inner
      .split(/,\s*/)
      .map((id) => Number(id.slice(1)))
      .filter((n) => web[n - 1]);
    if (!ids.length) return '';
    for (const n of ids) {
      const page = web[n - 1];
      citations[`D${n}`] = {
        label: domainOf(page.url),
        detail: [
          page.title,
          page.published ? `dated ${page.published}` : 'undated',
          'web page, not checked by Substrata',
        ].join(' · '),
        href: page.url,
      };
    }
    return `[${ids.map((n) => `D${n}`).join(', ')}]`;
  });
  return { content: text, citations };
}
