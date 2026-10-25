/**
 * Re-reads every source in research/series.json and checks that each point's
 * quote is still on the page.
 *
 *   pnpm tsx scripts/research/check-series.ts            # report
 *   pnpm tsx scripts/research/check-series.ts --strict   # exit 1 on any miss
 *   pnpm tsx scripts/research/check-series.ts --write    # report, then date what was re-read
 *
 * `--write` sets a series' `checkedOn` to today ONLY when every one of its
 * points was re-read in this run and its quote found. A series with a miss or
 * a page that could not be fetched keeps the date of its last real check, so
 * the freshness gate (test/freshness.test.ts, `series/quote-checked-recently`)
 * keeps naming it until a person fixes the point or the source comes back.
 * Nothing else in the file changes. `--only=<id,id>` limits the run to some
 * series (with `--write`, only those are re-dated).
 *
 * Not part of `verify`: it needs the network, and a publisher's outage is not
 * a broken build. Run it before committing new points and at least monthly
 * (the 30-day limit in config/substrata-freshness.ts). The scheduled quality
 * run (lib/quality/run.ts) re-reads a rotating sample with the same rule but
 * records verdicts in the database; it never writes this file.
 * That the quote states the value is a pure check in lib/quality/checks-series.ts.
 * PDFs need `pdftotext` (poppler) on the PATH.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { corpusSeries } from '../../lib/series';
import { pageText, quoteOnPage } from '../../lib/quality/page-text';

const FILE = new URL('../../research/series.json', import.meta.url);

/** The file with `checkedOn` moved for the named series, every other byte kept. */
export function redate(text: string, ids: ReadonlySet<string>, day: string): string {
  let out = text;
  for (const id of ids) {
    const start = out.indexOf(`"id": ${JSON.stringify(id)},`);
    if (start < 0) throw new Error(`series ${id} not in research/series.json`);
    const next = out.indexOf('"id": ', start + 1);
    const at = out.indexOf('"checkedOn": "', start);
    if (at < 0 || (next >= 0 && at > next)) throw new Error(`series ${id} has no checkedOn`);
    const from = at + '"checkedOn": "'.length;
    out = `${out.slice(0, from)}${day}${out.slice(from + 10)}`;
  }
  return out;
}

async function main() {
  const strict = process.argv.includes('--strict');
  const write = process.argv.includes('--write');
  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',');
  const pages = new Map<string, Promise<string>>();
  const read = (url: string, agent: string) => {
    const key = `${agent} ${url}`;
    if (!pages.has(key)) pages.set(key, pageText(url, agent));
    return pages.get(key)!;
  };
  let ok = 0;
  const problems: string[] = [];
  const allFound = new Set<string>();
  const filed = new Set(
    (JSON.parse(readFileSync(FILE, 'utf8')) as { series: { id: string }[] }).series.map(
      (s) => s.id,
    ),
  );
  for (const series of corpusSeries()) {
    if (only && !only.includes(series.id)) continue;
    let clean = series.points.length > 0;
    for (const point of series.points) {
      const { verdict, detail } = await quoteOnPage(point.source, point.quote ?? '', read);
      if (verdict === 'found') ok += 1;
      else {
        clean = false;
        problems.push(
          `${verdict === 'unreadable' ? `UNREACHABLE (${detail})` : 'MISS'}  ${series.id} ${point.date}  ${point.source}`,
        );
      }
    }
    if (clean && filed.has(series.id)) allFound.add(series.id);
  }
  console.log(`${ok} quotes found on their pages; ${problems.length} not`);
  for (const line of problems) console.log(line);
  if (write) {
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(FILE, redate(readFileSync(FILE, 'utf8'), allFound, today));
    console.log(`checkedOn set to ${today} on ${allFound.size} series whose every quote was found`);
  }
  if (strict && problems.length > 0) process.exit(1);
}

if (process.argv[1]?.endsWith('check-series.ts')) void main();
