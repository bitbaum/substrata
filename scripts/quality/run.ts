/**
 * The data-quality checks, on demand.
 *
 *   pnpm run quality                 # pure checks only (what `verify` runs), as a table
 *   pnpm run quality -- --network    # plus one scheduled-size network slice
 *   pnpm run quality -- --all        # plus EVERY link, quote, ticker and USGS row (~20 min)
 *   pnpm run quality -- --all --db   # same, written to the database (DATABASE_URL)
 *   pnpm run quality -- --json out.json   # machine-readable results with failing rows and links
 *
 * Without --db, network verdicts accumulate in /tmp/substrata-quality-checks.json,
 * so a second run continues the rotation. No AI anywhere.
 */
import { writeFileSync } from 'node:fs';

import { buildCards, assembleResults } from '../../lib/quality/report';
import { EVERYTHING, SCHEDULED, runQuality } from '../../lib/quality/run';
import { dbStore, fileStore } from '../../lib/quality/store';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const after = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

async function main() {
  const store = flag('--db') ? dbStore : fileStore('/tmp/substrata-quality-checks.json');
  let cards;
  if (flag('--all') || flag('--network')) {
    const run = await runQuality(store, flag('--all') ? EVERYTHING : SCHEDULED);
    console.error(
      `looked at ${run.looked}; ${run.failed} failed; ${run.cannotTell} could not tell`,
    );
    for (const e of run.errors) console.error(`  error: ${e}`);
    cards = run.cards;
  } else {
    cards = buildCards((await assembleResults(flag('--db') ? await store.load() : null)).results);
  }
  for (const card of cards) {
    const scores = card.scores.map(
      (s) =>
        `${s.criterion.slice(0, 5)} ${s.score === null ? '  —  ' : `${s.score.toFixed(1)}%`.padStart(6)}`,
    );
    console.log(
      `${card.dataset.id.padEnd(18)} ${card.overall === null ? '—' : `${card.overall}%`.padStart(6)}  ${scores.join('  ')}`,
    );
    for (const r of card.results.filter((x) => x.failures.length))
      console.log(
        `    ${r.check}: ${r.failures.length} failing${r.unchecked ? `, ${r.unchecked} unchecked` : ''}`,
      );
  }
  const out = after('--json');
  if (out)
    writeFileSync(
      out,
      JSON.stringify(
        cards.map((c) => ({
          dataset: c.dataset.id,
          overall: c.overall,
          scores: c.scores,
          counts: c.counts,
          results: c.results,
        })),
        null,
        1,
      ),
    );
}

void main();
