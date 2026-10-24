/**
 * Read a source document as text a quote can be checked against — the same
 * function for the adapters (which propose a quote) and for add.ts (which
 * checks it), so both see the same characters.
 *
 *   PDF   → each page's text (lib/sources/pdf.ts); the quote check reports the page
 *   JSON  → the body as served, so a quote is a span of the record itself
 *   HTML  → ai-kit's readable-text extraction, as add.ts always used
 *
 * Allow-listed hosts go through `sourceFetch` (their agent string, pace and
 * cache). Any other host is read with ai-kit's SSRF guard checked on every
 * redirect hop, because a candidate row may cite any public page.
 */
import { extractReadableText, validateFetchTarget, type LookupFn } from '@bitbaum/ai-kit/web';

import { USER_AGENT, hostRule } from './hosts';
import { bodyText, sourceFetch, type FetchDeps, type FetchedBody } from './http';
import { isPdf, pdfPages } from './pdf';

export type DocumentKind = 'pdf' | 'json' | 'html';

export type DocumentRead =
  | {
      ok: true;
      url: string;
      kind: DocumentKind;
      /** The whole text; for a PDF its pages joined by newlines. */
      text: string;
      /** Only for a PDF: each page's text, page 1 first. */
      pages?: string[];
      fetchedAt: string;
    }
  | { ok: false; url: string; reason: string; transient: boolean };

export interface DocumentDeps extends FetchDeps {
  lookup?: LookupFn;
}

const MAX_TEXT = 20_000_000;
const OPEN_WEB_MAX_BYTES = 64 * 1024 * 1024;
const ACCEPT = 'text/html,application/xhtml+xml,application/json,application/pdf;q=0.9,*/*;q=0.5';

/** The fetched body as quote-checkable text. */
export async function documentText(
  f: Pick<FetchedBody, 'url' | 'body' | 'contentType' | 'fetchedAt'>,
): Promise<DocumentRead> {
  if (isPdf(f.body, f.contentType)) {
    const pages = await pdfPages(f.body);
    return {
      ok: true,
      url: f.url,
      kind: 'pdf',
      text: pages.join('\n'),
      pages,
      fetchedAt: f.fetchedAt,
    };
  }
  const raw = bodyText(f);
  const head = raw.trimStart()[0];
  if (f.contentType.includes('json') || head === '{' || head === '[') {
    return { ok: true, url: f.url, kind: 'json', text: raw, fetchedAt: f.fetchedAt };
  }
  return {
    ok: true,
    url: f.url,
    kind: 'html',
    text: extractReadableText(raw, MAX_TEXT).text,
    fetchedAt: f.fetchedAt,
  };
}

/** GET a page on the open web: SSRF-checked at every hop, capped, no cache. */
async function openWebFetch(url: string, deps: DocumentDeps): Promise<FetchedBody> {
  const doFetch = deps.fetch ?? globalThis.fetch;
  let target = url;
  for (let hop = 0; hop <= 3; hop++) {
    const verdict = await validateFetchTarget(target, deps.lookup);
    if (!verdict.ok) throw Object.assign(new Error(verdict.reason), { permanent: true });
    const res = await doFetch(verdict.url.toString(), {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: ACCEPT },
      signal: AbortSignal.timeout(deps.timeoutMs ?? 30_000),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error(`Redirect ${res.status} with no destination.`);
      target = new URL(location, verdict.url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`${target} answered ${res.status}.`);
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > OPEN_WEB_MAX_BYTES) throw new Error(`${target} is larger than 64 MB; refused.`);
    const body = new Uint8Array(await res.arrayBuffer());
    return {
      url,
      status: res.status,
      contentType: (res.headers.get('content-type') ?? '').toLowerCase(),
      body,
      fetchedAt: new Date((deps.now ?? Date.now)()).toISOString(),
      fromCache: false,
    };
  }
  throw new Error('More than 3 redirects.');
}

function isTransient(error: Error): boolean {
  return /timeout|timed out|aborted|ECONN|ENOTFOUND|EAI_AGAIN|fetch failed|answered (429|5\d\d)/i.test(
    `${error.name} ${error.message}`,
  );
}

/** Read `url` as text, or say why not. Never throws. */
export async function readDocument(url: string, deps: DocumentDeps = {}): Promise<DocumentRead> {
  try {
    const fetched = hostRule(url)
      ? await sourceFetch(url, ACCEPT, deps)
      : await openWebFetch(url, deps);
    return await documentText(fetched);
  } catch (error) {
    const e = error as Error & { permanent?: boolean };
    return { ok: false, url, reason: e.message, transient: !e.permanent && isTransient(e) };
  }
}
