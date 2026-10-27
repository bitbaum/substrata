/**
 * Build the company universe's evidence: read every source adapter, join the
 * rows into companies (lib/universe/identity.ts), write research/universe.json,
 * then apply the rule (lib/universe/admit.ts) and print what it admitted.
 *
 *   pnpm exec tsx scripts/research/universe.ts            read, write, report
 *   pnpm exec tsx scripts/research/universe.ts --report   report on the committed file only
 *
 * Free sources only, each on the allow-list (lib/sources/HOSTS.md). A source
 * that cannot be read is reported and skipped; nothing is invented to fill it.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { FUNDS } from '@/config/universe-sources';
import { SIZE_FLOORS } from '@/config/universe-themes';
import { graphNode, graphStore } from '@/lib/graph/index';
import { listingFor } from '@/lib/listings';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { fundRows, readFund } from '@/lib/sources/etf-holdings';
import {
  floatRow,
  readFloats,
  readSicFilers,
  readTickers,
  sicRow,
  tickerRow,
} from '@/lib/sources/edgar-universe';
import { readRevenue, revenueRow } from '@/lib/sources/edgar-revenue';
import { nameKey } from '@/lib/sources/name-key';
import { leiForIsin, leiRow, qidRow, qidsForIsins } from '@/lib/sources/registry-ids';
import { industryMembers, industryRow } from '@/lib/sources/wikidata-universe';
import { IdentityIndex } from '@/lib/universe/identity';
import { report } from '@/lib/universe/report';
import {
  AGENT_ROWS,
  UNIVERSE_FILE,
  bestName,
  buildUniverse,
  todayIso,
  type FundRead,
} from '@/lib/universe/store';
import { slugify } from '@/lib/links';
import type { UniverseRow } from '@/lib/universe/types';

const ROOT = path.resolve(import.meta.dirname, '../..');
const log = (line: string) => process.stdout.write(`${line}\n`);

const reuseOf = (index: IdentityIndex) => index.reused();

function seedIndex(): IdentityIndex {
  const reuse = new Map<string, string>();
  for (const [id] of graphStore().nodes)
    if (id.startsWith('company:') && !graphNode(id).inDirectory)
      reuse.set(nameKey(graphNode(id).name), id.slice('company:'.length));
  const index = new IdentityIndex(reuse);
  for (const p of MARKET_PARTICIPANTS) {
    index.add(p.slug, { name: p.name });
    const l = listingFor(p.slug);
    if (l?.status !== 'listed') continue;
    if (l.primary) index.add(p.slug, { ticker: l.primary.ticker, exchange: l.primary.exchange });
    if (l.us)
      index.add(p.slug, {
        ticker: l.us.ticker,
        exchange: 'US',
        cik: l.us.cik ? String(l.us.cik) : undefined,
      });
  }
  return index;
}

async function build(today: string) {
  const index = seedIndex();
  const rows: UniverseRow[] = [];
  const funds: FundRead[] = [];

  for (const fund of FUNDS) {
    const read = await readFund(fund, today);
    funds.push({
      id: fund.id,
      url: read.url,
      asOf: read.asOf,
      rows: read.holdings.length,
      status: read.error ?? 'read',
    });
    log(`fund ${fund.id}: ${read.error ?? `${read.holdings.length} holdings as of ${read.asOf}`}`);
    rows.push(
      ...fundRows(
        read,
        (h) =>
          index.resolve({ cusip: h.cusip, ticker: h.ticker, exchange: h.exchange, name: h.name }),
        today,
      ),
    );
  }

  const tickers = await readTickers();
  const byTicker = new Map(tickers.rows.map((t) => [t.ticker.toUpperCase(), t]));
  const floats = await readFloats();
  log(`edgar: ${tickers.rows.length} tickers, ${floats.size} public floats`);

  // US-listed companies found in funds: their CIK from EDGAR's ticker file, then their float.
  for (const row of [...rows]) {
    const ids = row.establishes.ids;
    if (ids?.exchange !== 'US' || !ids.ticker) continue;
    const t = byTicker.get(ids.ticker.toUpperCase());
    if (!t || rows.some((r) => r.company === row.company && r.establishes.ids?.cik)) continue;
    index.add(row.company, { cik: t.cik });
    rows.push(tickerRow(row.company, t, today, tickers.fetchedAt));
  }

  // Filers whose own SIC code is a theme code, admitted only with a float over the floor.
  const floor = SIZE_FLOORS.find((f) => f.basis === 'public-float')!.floorUsd;
  for (const filer of await readSicFilers()) {
    if (filer.quote.length < 20) continue;
    const known = index.find({ cik: filer.cik });
    const f = floats.get(filer.cik);
    if (!known && (!f || f.usd < floor)) continue;
    const t = tickers.rows.find((x) => x.cik === filer.cik);
    const slug =
      known ?? index.resolve({ cik: filer.cik, ticker: t?.ticker, name: f?.name ?? filer.name });
    rows.push(sicRow(slug, filer, today));
    if (!known && t) rows.push(tickerRow(slug, t, today, tickers.fetchedAt));
  }

  for (const slug of new Set(rows.map((r) => r.company))) {
    const cik = rows.find((r) => r.company === slug && r.establishes.ids?.cik)?.establishes.ids
      ?.cik;
    const f = cik ? floats.get(cik) : undefined;
    if (f) rows.push(floatRow(slug, f, today));
  }

  // A filer with no float over the floor (a foreign private issuer files no 10-K
  // cover) may still state annual revenue in dollars: read it, and let the
  // revenue floor decide. Only companies that have no cleared size yet.
  const cleared = (slug: string) =>
    rows.some(
      (r) =>
        r.company === slug &&
        r.establishes.size &&
        r.establishes.size.usd >=
          (SIZE_FLOORS.find((f) => f.basis === r.establishes.size!.basis)?.floorUsd ?? Infinity),
    );
  let revenues = 0;
  for (const slug of new Set(rows.map((r) => r.company))) {
    if (cleared(slug) || MARKET_PARTICIPANTS.some((p) => p.slug === slug)) continue;
    const cik = rows.find((r) => r.company === slug && r.establishes.ids?.cik)?.establishes.ids
      ?.cik;
    if (!cik) continue;
    const read = await readRevenue(cik);
    if (!read) continue;
    rows.push(revenueRow(slug, read, today));
    revenues++;
  }
  log(`edgar revenue: ${revenues} companies with a dollar revenue read`);

  // Registry identifiers by ISIN: LEI (GLEIF) and QID (Wikidata).
  const isins = new Map<string, string>();
  for (const r of rows) if (r.establishes.ids?.isin) isins.set(r.establishes.ids.isin, r.company);
  const nameOf = (slug: string) => rows.find((r) => r.company === slug)?.name ?? slug;
  for (const hit of await qidsForIsins([...isins.keys()])) {
    const slug = isins.get(hit.isin)!;
    index.add(slug, { qid: hit.qid });
    rows.push(qidRow(slug, nameOf(slug), hit, today));
  }
  let leis = 0;
  for (const [isin, slug] of isins) {
    const hit = await leiForIsin(isin).catch(() => null);
    if (!hit) continue;
    rows.push(leiRow(slug, hit, today));
    leis++;
  }
  log(`registry ids: ${leis} LEIs over ${isins.size} ISINs`);

  // Wikidata industry classes: theme evidence (and a QID), never a size.
  for (const m of await industryMembers()) {
    const slug = index.resolve({ qid: m.qid, isin: m.isin, name: m.label });
    rows.push(industryRow(slug, m, today));
  }

  // A company first met under a fund's abbreviation ("SPACE EXPLORATION TECHN-CL A")
  // takes the slug of its best name ("spacex") — unless it is a directory or stub slug.
  const fixed = new Set([...MARKET_PARTICIPANTS.map((p) => p.slug), ...reuseOf(index)]);
  const all = new Set(rows.map((r) => r.company));
  for (const slug of [...all]) {
    if (fixed.has(slug)) continue;
    const want = slugify(nameKey(bestName(rows.filter((r) => r.company === slug))));
    if (!want || want === slug || all.has(want)) continue;
    for (const r of rows) if (r.company === slug) r.company = want;
    all.delete(slug);
    all.add(want);
  }

  rows.sort(
    (a, b) => a.company.localeCompare(b.company) || a.source.url.localeCompare(b.source.url),
  );
  return { version: 1 as const, readOn: today, funds, rows };
}

async function main() {
  const today = todayIso();
  const onlyReport = process.argv.includes('--report');
  const file = onlyReport ? UNIVERSE_FILE : await build(today);
  if (!onlyReport)
    await writeFile(
      path.join(ROOT, 'research/universe.json'),
      `${JSON.stringify(file, null, 1)}\n`,
    );
  log(report(buildUniverse([...file.rows, ...AGENT_ROWS], today)));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exit(1);
});
