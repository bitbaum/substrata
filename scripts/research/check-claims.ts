/**
 * Re-checks research/claims.json against what it rests on, after
 * check-series.ts has re-read the series.
 *
 *   pnpm tsx scripts/research/check-claims.ts            # report
 *   pnpm tsx scripts/research/check-claims.ts --write    # report, then date the file if it held
 *
 * A claim is checked when its sentence still reads verbatim in its file, on a
 * real bottleneck, citing series that exist (the pure checks
 * `claims/series-agree` and `claims/verdict-how`), AND every series it cites
 * had every quote re-read and found TODAY (`checkedOn` = today, which only
 * `check-series.ts --write` sets). The file carries one date, so `--write`
 * moves it only when every claim passes; otherwise nothing changes and the
 * claims that did not are listed.
 *
 * Whether the newest numbers still bear the sentence out is a reading, not a
 * string match: the report prints each cited series' latest value next to the
 * claim so the reviewer of the data PR reads them, and a claim the numbers no
 * longer carry is re-worded (or its verdict changed) in that PR.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { allClaims } from '../../lib/claims';
import { corpusSeries } from '../../lib/series';
import { corpusChecks } from '../../lib/quality/checks-corpus';

const FILE = new URL('../../research/claims.json', import.meta.url);

function main() {
  const write = process.argv.includes('--write');
  const today = new Date().toISOString().slice(0, 10);
  const series = new Map(corpusSeries().map((s) => [s.id, s]));
  const pure = corpusChecks().filter((r) => r.dataset === 'claims');
  const failures = pure.flatMap((r) =>
    r.failures.map((f) => `${r.check}: ${f.row} — ${f.problem}`),
  );
  const unread: string[] = [];
  for (const claim of allClaims()) {
    console.log(`\n${claim.verdict.toUpperCase()}  ${claim.bottleneck}: “${claim.text}”`);
    for (const id of claim.series) {
      const s = series.get(id);
      const last = s?.points.at(-1);
      console.log(
        `  ${id}: ${last ? `${last.value} ${s?.unit} (${last.date})` : 'no points'}; re-read ${s?.checkedOn ?? '—'}`,
      );
      if (s?.checkedOn !== today) unread.push(`${claim.bottleneck}: ${id} not re-read today`);
    }
  }
  const problems = [...failures, ...unread];
  console.log(`\n${problems.length === 0 ? 'every claim held' : `${problems.length} problems`}`);
  for (const p of problems) console.log(`NOT CHECKED  ${p}`);
  if (write && problems.length === 0) {
    const text = readFileSync(FILE, 'utf8');
    const next = text.replace(/("checkedOn": ")\d{4}-\d{2}-\d{2}"/, `$1${today}"`);
    writeFileSync(FILE, next);
    console.log(`claims checkedOn set to ${today}`);
  } else if (write) console.log('claims checkedOn left as it was');
}

main();
