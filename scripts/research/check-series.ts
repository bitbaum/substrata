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
 * a page that could not be fetched keeps the date of its last real check and
 * goes on the file's `unconfirmed` list with the reason and today's date
 * (lib/freshness/unconfirmed.ts); a series confirmed later leaves the list.
 * The freshness gate counts a listed series as tried, not as fresh, and the
 * entry expires like any date. Nothing else in the file changes.
 * `--only=<id,id>` limits the run (with `--write`, only those are touched).
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
import { updateUnconfirmed, type Unconfirmed } from '../../lib/freshness/unconfirmed';

const FILE = new URL('../../research/series.json', import.meta.url);

/** The file with `checkedOn` moved for the named series, every other byte kept. */
export function redate(text: string, ids: ReadonlySet<string>, day: string): string {
  let out = text;
  // Ids also appear in "unconfirmed" above the series; look only in the series.
  const body = Math.max(0, out.indexOf('"series": ['));
  for (const id of ids) {
    const start = out.indexOf(`"id": ${JSON.stringify(id)},`, body);
    if (start < 0) throw new Error(`series ${id} not in research/series.json`);
    const next = out.indexOf('"id": ', start + 1);
    const at = out.indexOf('"checkedOn": "', start);
    if (at < 0 || (next >= 0 && at > next)) throw new Error(`series ${id} has no checkedOn`);
    const from = at + '"checkedOn": "'.length;
    out = `${out.slice(0, from)}${day}${out.slice(from + 10)}`;
  }
  return out;
}

/** The file with its top-level "unconfirmed" list replaced, every other byte kept. */
export function withUnconfirmed(text: string, list: readonly Unconfirmed[]): string {
  const start = text.indexOf('  "unconfirmed": ');
  const end = text.indexOf('\n  "series": [');
  if (start < 0 || end < start) throw new Error('research/series.json has no "unconfirmed" list');
  const json = JSON.stringify(list, null, 2).replace(/\n/g, '\n  ');
  return `${text.slice(0, start)}  "unconfirmed": ${json},${text.slice(end)}`;
}

/** One line per series: how many points failed, and each distinct way they did. */
function reasonFor(failures: readonly string[], total: number): string {
  const ways = [...new Set(failures)];
  return `${failures.length} of ${total} points not confirmed: ${ways.join('; ')}`;
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
  const failed: { id: string; reason: string }[] = [];
  const filed = new Set(
    (JSON.parse(readFileSync(FILE, 'utf8')) as { series: { id: string }[] }).series.map(
      (s) => s.id,
    ),
  );
  for (const series of corpusSeries()) {
    if (only && !only.includes(series.id)) continue;
    const ways: string[] = [];
    for (const point of series.points) {
      const { verdict, detail } = await quoteOnPage(point.source, point.quote ?? '', read);
      if (verdict === 'found') ok += 1;
      else {
        const host = new URL(point.source).host;
        ways.push(verdict === 'unreadable' ? `${host} answered ${detail}` : `quote not on ${host}`);
        problems.push(
          `${verdict === 'unreadable' ? `UNREACHABLE (${detail})` : 'MISS'}  ${series.id} ${point.date}  ${point.source}`,
        );
      }
    }
    if (!filed.has(series.id)) continue;
    if (series.points.length > 0 && ways.length === 0) allFound.add(series.id);
    else failed.push({ id: series.id, reason: reasonFor(ways, series.points.length) });
  }
  console.log(`${ok} quotes found on their pages; ${problems.length} not`);
  for (const line of problems) console.log(line);
  if (write) {
    const today = new Date().toISOString().slice(0, 10);
    const text = readFileSync(FILE, 'utf8');
    const listed = (JSON.parse(text) as { unconfirmed: Unconfirmed[] }).unconfirmed;
    const unconfirmed = updateUnconfirmed(listed, { confirmed: [...allFound], failed }, today);
    writeFileSync(FILE, withUnconfirmed(redate(text, allFound, today), unconfirmed));
    console.log(`checkedOn set to ${today} on ${allFound.size} series whose every quote was found`);
    console.log(`unconfirmed: ${unconfirmed.length} series (${failed.length} tried today)`);
  }
  if (strict && problems.length > 0) process.exit(1);
}

if (process.argv[1]?.endsWith('check-series.ts')) void main();
