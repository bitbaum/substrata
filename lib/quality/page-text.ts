/**
 * Reading a source the way a person would, to see whether a quoted sentence
 * is still on it. Shared by the series checker (scripts/research/check-series.ts)
 * and the scheduled quality run, so both judge a quote by one rule.
 *
 * PDFs need `pdftotext` (poppler). Where it is missing the read fails as
 * "cannot read PDF here", which is reported as not checked — never as a miss.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Some publishers serve a different page per user agent, so a miss is retried with the other. */
export const AGENTS = [
  'Mozilla/5.0 (X11; Linux x86_64)',
  'Mozilla/5.0 (compatible; Substrata research; https://substrata.orangecat.ch)',
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
): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': agent, Accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
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
  return (
    body
      .toString('utf8')
      // RSS and XHTML wrap text in CDATA; stripped as a tag, the text would go with it.
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, ' $1 ')
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
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
): Promise<{ verdict: QuoteVerdict; detail: string }> {
  const parts = quoteParts(quote);
  let failure = '';
  let readOnce = false;
  for (const agent of AGENTS) {
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
