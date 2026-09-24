/**
 * Re-reads every source in research/series.json and checks that each point's
 * quote is still on the page, and that the quote carries the number.
 *
 *   pnpm tsx scripts/research/check-series.ts            # report
 *   pnpm tsx scripts/research/check-series.ts --strict   # exit 1 on any miss
 *
 * Not part of `verify`: it needs the network, and a publisher's outage is not
 * a broken build. Run it before committing new points, and on a schedule to
 * find pages that moved. PDFs need `pdftotext` (poppler) on the PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { corpusSeries } from '../../lib/series';

/** Some publishers serve a different page per user agent, so a miss is retried with the other. */
const AGENTS = ['Mozilla/5.0 (X11; Linux x86_64)', 'Mozilla/5.0 (compatible; Substrata research)'];
const dir = mkdtempSync(join(tmpdir(), 'series-check-'));

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
      .replace(/\\(["'\/])/g, '$1')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[‐‑‒–—−]/g, '-')
      .replace(/\s+/g, ' ')
      // A word hyphenated across a line break in a PDF ("de- spite").
      .replace(/([a-z])- ([a-z])/g, '$1$2')
      .trim()
      .toLowerCase()
  );
}

/** The page as text; a PDF twice, laid out and in reading order, since columns interleave. */
async function pageText(url: string, agent: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': agent, Accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  const body = Buffer.from(await response.arrayBuffer());
  if (type.includes('pdf') || body.subarray(0, 5).toString() === '%PDF-') {
    const file = join(dir, `${Math.random().toString(36).slice(2)}.pdf`);
    writeFileSync(file, body);
    const run = (args: string[]) =>
      execFileSync('pdftotext', [...args, file, '-'], {
        maxBuffer: 64 << 20,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString();
    return `${run(['-layout'])}\n${run([])}`;
  }
  return body
    .toString('utf8')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

async function main() {
  const strict = process.argv.includes('--strict');
  const pages = new Map<string, Promise<string>>();
  const read = (url: string, agent: string) => {
    const key = `${agent} ${url}`;
    if (!pages.has(key)) pages.set(key, pageText(url, agent));
    return pages.get(key)!;
  };
  let ok = 0;
  const problems: string[] = [];
  for (const series of corpusSeries()) {
    for (const point of series.points) {
      const label = `${series.id} ${point.date}`;
      // A table row wrapped across two lines is quoted joined with " / ".
      const parts = normalise(point.quote ?? '')
        .split(' / ')
        .map((part) => part.replace(/[.;,]$/, ''));
      let found = false;
      let failure = '';
      for (const agent of AGENTS) {
        try {
          const text = normalise(await read(point.source, agent));
          if (parts.every((part) => text.includes(part))) found = true;
        } catch (error) {
          failure = (error as Error).message;
        }
        if (found) break;
      }
      if (found) ok += 1;
      else
        problems.push(
          `${failure ? `UNREACHABLE (${failure})` : 'MISS'}  ${label}  ${point.source}`,
        );
    }
  }
  console.log(`${ok} quotes found on their pages; ${problems.length} not`);
  for (const line of problems) console.log(line);
  if (strict && problems.length > 0) process.exit(1);
}

void main();
