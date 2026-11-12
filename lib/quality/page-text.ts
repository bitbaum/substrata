/**
 * Reading a source the way a person would, to see whether a quoted sentence
 * is still on it. Shared by the series checker (scripts/research/check-series.ts)
 * and the scheduled quality run, so both judge a quote by one rule.
 *
 * PDFs need `pdftotext` (poppler). Where it is missing the read fails as
 * "cannot read PDF here", which is reported as not checked — never as a miss.
 *
 * Every request goes through `guardedFetch`: ai-kit's SSRF guard
 * (`validateFetchTarget`) on the first URL and on every redirect hop, so a
 * source link that redirects into the private network or the cloud metadata
 * service is refused instead of read. ai-kit's `readPage` is not used for the
 * body: it refuses PDFs, sends its own user agent and keeps only the
 * article-like part of a page, and a quote in a table or a PDF must still be
 * found where it is.
 */
import { defaultLookup, validateFetchTarget, type LookupFn } from '@bitbaum/ai-kit/web';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SITE } from '../site';

/** Some publishers serve a different page per user agent, so a miss is retried with the other. */
export const AGENTS = [
  'Mozilla/5.0 (X11; Linux x86_64)',
  `Mozilla/5.0 (compatible; Substrata research; ${SITE.url})`,
];

const NAMED: Record<string, string> = {
  euro: '€',
  pound: '£',
  yen: '¥',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  hellip: '…',
  middot: '·',
  deg: '°',
};

/** Whitespace, typographic quotes and dashes, entities: the ways a copy differs from its page. */
export function normalise(text: string): string {
  return (
    text
      .replace(/\\u([0-9a-f]{4})/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
      .replace(
        /&(euro|pound|yen|rsquo|lsquo|rdquo|ldquo|hellip|middot|deg);/g,
        (_, n: string) => NAMED[n],
      )
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&[nm]dash;/g, '-')
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/\\(["'/])/g, '$1')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[‐‑‒–—−]/g, '-')
      .replace(/\s+/g, ' ')
      // A tag between a word and its comma ("figures</a>, ASML") leaves a space.
      .replace(/ ([,.;:])/g, '$1')
      // A word hyphenated across a line break in a PDF ("de- spite").
      .replace(/([a-z])- ([a-z])/g, '$1$2')
      .trim()
      .toLowerCase()
  );
}

/** The parts a quote must all be found as: a table row wrapped across lines is quoted joined with " / ". */
export function quoteParts(quote: string): string[] {
  return normalise(quote)
    .split(' / ')
    .map((part) => part.replace(/[.;,]$/, ''))
    .filter((part) => part.length > 0);
}

export class ReadError extends Error {
  constructor(
    message: string,
    /** HTTP status, when there was one. */
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Hops followed before giving up, each one checked again. */
export const MAX_REDIRECTS = 5;

export interface GuardedFetchDeps {
  fetch?: typeof globalThis.fetch;
  lookup?: LookupFn;
}

/**
 * `fetch` with `redirect: 'manual'` and ai-kit's SSRF guard on every hop.
 * A refused target throws a `ReadError` naming why. A lookup that failed is
 * rethrown the way `fetch` reports it (a TypeError whose cause carries the
 * resolver's code), so a resolver's "try again" still reads as the checker's
 * own network and a name that does not exist still reads as the link's.
 */
export async function guardedFetch(
  url: string,
  init: Omit<RequestInit, 'redirect'>,
  deps: GuardedFetchDeps = {},
): Promise<Response> {
  const doFetch = deps.fetch ?? globalThis.fetch;
  const resolve = deps.lookup ?? defaultLookup;
  let target = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let lookupError: unknown;
    const lookup: LookupFn = async (host) => {
      try {
        return await resolve(host);
      } catch (error) {
        lookupError = error;
        throw error;
      }
    };
    const verdict = await validateFetchTarget(target, lookup);
    if (!verdict.ok) {
      if (lookupError) throw new TypeError('fetch failed', { cause: lookupError });
      throw new ReadError(`refused: ${verdict.reason}`);
    }
    const response = await doFetch(verdict.url.toString(), { ...init, redirect: 'manual' });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    // A 304 or a 3xx with nowhere to go is the answer itself.
    if (!location) return response;
    await response.body?.cancel().catch(() => undefined);
    target = new URL(location, verdict.url).toString();
  }
  throw new ReadError(`more than ${MAX_REDIRECTS} redirects`);
}

function pdfToText(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile('pdftotext', [...args, file, '-'], { maxBuffer: 64 << 20 }, (error, stdout) => {
      if (error && (error as NodeJS.ErrnoException).code === 'ENOENT')
        reject(new ReadError('cannot read PDF here (no pdftotext)'));
      else if (error) reject(new ReadError(`pdftotext failed: ${error.message.slice(0, 80)}`));
      else resolve(stdout);
    }),
  );
}

/** The page as text; a PDF twice, laid out and in reading order, since columns interleave. */
export async function pageText(
  url: string,
  agent = AGENTS[0],
  timeoutMs = 45_000,
  signal?: AbortSignal,
  deps?: GuardedFetchDeps,
): Promise<string> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await guardedFetch(
    url,
    { headers: { 'User-Agent': agent, Accept: '*/*' }, signal: combinedSignal },
    deps,
  );
  if (!response.ok) throw new ReadError(`HTTP ${response.status}`, response.status);
  const type = response.headers.get('content-type') ?? '';
  const body = Buffer.from(await response.arrayBuffer());
  if (type.includes('pdf') || body.subarray(0, 5).toString() === '%PDF-') {
    const dir = await mkdtemp(join(tmpdir(), 'quality-'));
    const file = join(dir, 'source.pdf');
    try {
      await writeFile(file, body);
      return `${await pdfToText(file, ['-layout'])}\n${await pdfToText(file, [])}`;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  return htmlText(body.toString('utf8'));
}

/** A page's HTML as the text a reader sees: tags become spaces, except where they cannot. */
export function htmlText(html: string): string {
  return (
    html
      // RSS and XHTML wrap text in CDATA; stripped as a tag, the text would go with it.
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, ' $1 ')
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
      // A word split between two style runs ("EU</font><font …>V", as SEC filings
      // print them) renders as one word; any other tag is a space.
      .replace(/([a-z])<\/(font|span)><\2\b[^>]*>(?=[a-z])/gi, '$1')
      .replace(/<[^>]+>/g, ' ')
  );
}

export type QuoteVerdict = 'found' | 'missing' | 'unreadable';

/**
 * Whether every part of the quote is on the page, trying each user agent.
 * `unreadable` (the page could not be fetched or parsed) is not a miss.
 */
export async function quoteOnPage(
  url: string,
  quote: string,
  read: (url: string, agent: string) => Promise<string> = pageText,
  signal?: AbortSignal,
): Promise<{ verdict: QuoteVerdict; detail: string }> {
  const parts = quoteParts(quote);
  let failure = '';
  let readOnce = false;
  for (const agent of AGENTS) {
    if (signal?.aborted) break;
    try {
      const text = normalise(await read(url, agent));
      readOnce = true;
      if (parts.every((part) => text.includes(part))) return { verdict: 'found', detail: '' };
    } catch (error) {
      const cause = ((error as Error).cause as Error | undefined)?.message;
      failure =
        error instanceof Error ? `${error.message}${cause ? ` (${cause})` : ''}` : 'read failed';
    }
  }
  return readOnce
    ? { verdict: 'missing', detail: 'the quoted text is not on the page' }
    : { verdict: 'unreadable', detail: failure };
}
