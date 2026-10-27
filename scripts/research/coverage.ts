/**
 * Coverage of the company universe, in numbers a reader can check: how many
 * candidates there are, how many were admitted and which test kept the rest
 * out, what each admitted company's page can show, and the gaps that follow.
 *
 *   pnpm exec tsx scripts/research/coverage.ts
 *
 * Offline: reads the committed evidence only (research/universe.json and
 * config/candidates/universe.json) and applies the rule as of today.
 */
import { THEMES } from '@/config/universe-themes';
import { PAGE_KINDS, pageKindCounts, pageKindOf } from '@/lib/universe/page-kinds';
import { counts } from '@/lib/universe/report';
import { UNIVERSE_FILE, universeEntries } from '@/lib/universe/store';

const log = (s = '') => process.stdout.write(`${s}\n`);

const entries = universeEntries();
const c = counts(entries);
const admitted = entries.filter((e) => e.admitted);

log(`evidence rows: ${UNIVERSE_FILE.rows.length} (read ${UNIVERSE_FILE.readOn})`);
log(`candidates (companies with evidence or a directory row): ${entries.length}`);
log(
  `admitted: ${admitted.length} (tier A ${c.tiers.A}, tier B ${c.tiers.B}); not admitted: ${c.out}`,
);
const combos: Record<string, number> = {};
for (const e of entries.filter((x) => !x.admitted)) {
  const k = e.failed.join(' + ');
  combos[k] = (combos[k] ?? 0) + 1;
}
log(`not admitted, by failed test: ${JSON.stringify(combos)}`);
log();
const kinds = pageKindCounts(entries);
for (const k of PAGE_KINDS) log(`page: ${k.label}: ${kinds[k.kind]}`);
const venues: Record<string, number> = {};
for (const e of admitted)
  if (e.ids.ticker && pageKindOf(e) === 'identity')
    venues[e.ids.exchange ?? '?'] = (venues[e.ids.exchange ?? '?'] ?? 0) + 1;
log(
  `identity-only with a ticker on a venue the price source cannot serve: ${JSON.stringify(venues)}`,
);
log();
for (const t of THEMES)
  log(`theme ${t.id}: ${c.byTheme.find((x) => x.theme === t.id)?.count ?? 0}`);
log(`countries: ${c.byCountry.length}; none stated: ${c.noCountry}`);
log(c.byCountry.map((x) => `${x.country} ${x.count}`).join(', '));
