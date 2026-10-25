/**
 * Market data by hand: backfill the database, or re-record the test fixtures.
 *
 *   DATABASE_URL=… pnpm exec tsx scripts/research/market-data.ts --backfill
 *       Five years of daily closes for every seed listing into
 *       research_price_points (the cron keeps them current after that), then
 *       the EDGAR fundamentals and holders snapshots. Needs
 *       scripts/db/016-market-data.sql applied. Re-runnable: rows upsert.
 *
 *   pnpm exec tsx scripts/research/market-data.ts --fixtures
 *       Re-records test/fixtures/market/ from the live sources: small real
 *       responses (a year of NVIDIA closes, company facts cut to the concepts
 *       lib/market-data reads, three Schedules 13G, one Form 4, the ownership
 *       pages of six proxies). Run it when a test says a source changed shape.
 *
 * Every read goes through lib/sources/http.ts (allow-listed hosts, honest
 * agent string, pace) and is cached under .tmp/sources/ for a day.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { MARKET_SEED, tickerKey } from '@/lib/market-data/identity';
import { fetchAllPrices } from '@/lib/market-data/prices/store';
import { refreshMarketFacts } from '@/lib/market-data/facts-run';
import { METRICS, companyFactsUrl, type CompanyFacts } from '@/lib/market-data/fundamentals/xbrl';
import { bodyText, sourceFetch } from '@/lib/sources/http';
import { readDocument } from '@/lib/sources/document';
import { squash } from '@/lib/event-rules';

const OUT = path.join(process.cwd(), 'test/fixtures/market');
const get = async (url: string) => bodyText(await sourceFetch(url, '*/*'));

/** Company facts with only the concepts read here, from 2019 on: real rows, a fraction of the bytes. */
function cut(cf: CompanyFacts): CompanyFacts {
  const facts: CompanyFacts['facts'] = {};
  for (const concept of METRICS.flatMap((m) => m.concepts)) {
    const [ns, name] = concept.split(':');
    const units = cf.facts[ns]?.[name]?.units;
    if (!units) continue;
    facts[ns] ??= {};
    facts[ns][name] = {
      units: Object.fromEntries(
        Object.entries(units).map(([u, rows]) => [u, rows.filter((r) => r.end >= '2019-01-01')]),
      ),
    };
  }
  return { cik: cf.cik, entityName: cf.entityName, facts };
}

const PROXIES: Record<string, string> = {
  nvidia: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000036/nvda-20260512.htm',
  amd: 'https://www.sec.gov/Archives/edgar/data/2488/000119312526129057/d85856ddef14a.htm',
  amazon:
    'https://www.sec.gov/Archives/edgar/data/1018724/000110465926041026/tm261382-1_def14a.htm',
  tesla: 'https://www.sec.gov/Archives/edgar/data/1318605/000110465926116700/tm267596-1_def14a.htm',
  'ge-vernova':
    'https://www.sec.gov/Archives/edgar/data/1996810/000199681026000049/gev-20260402.htm',
  microsoft: 'https://www.sec.gov/Archives/edgar/data/789019/000119312526427849/d61756ddef14a.htm',
};

const XML: Record<string, string> = {
  'nvda-13g-vanguard-zero.xml':
    'https://www.sec.gov/Archives/edgar/data/1045810/000010290926000426/primary_doc.xml',
  'nvda-13g-vcm.xml':
    'https://www.sec.gov/Archives/edgar/data/1045810/000210011926000017/primary_doc.xml',
  'nvda-13g-filed-by-nvidia.xml':
    'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000062/primary_doc.xml',
  'nvda-form4.xml':
    'https://www.sec.gov/Archives/edgar/data/1045810/000119764726000011/wk-form4_1791579847.xml',
};

/** The ownership pages of a proxy: 6,000 characters either side of its first 5%-holder row. */
function ownershipExcerpt(text: string): string {
  const row = text.search(/(?:Vanguard|BlackRock)[^%]{0,200}\d{1,3}(?:,\d{3})+[^%]{0,40}%/);
  if (row < 0) throw new Error('no ownership table found');
  return text.slice(Math.max(0, row - 6000), row + 6000);
}

async function fixtures() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    path.join(OUT, 'yahoo-nvda-1y.json'),
    await get('https://query1.finance.yahoo.com/v8/finance/chart/NVDA?range=1y&interval=1d'),
  );
  writeFileSync(
    path.join(OUT, 'yahoo-8035-5d.json'),
    await get('https://query1.finance.yahoo.com/v8/finance/chart/8035.T?range=5d&interval=1d'),
  );
  for (const [file, cik] of [
    ['companyfacts-nvda.json', 1045810],
    ['companyfacts-tsmc.json', 1046179],
  ] as const)
    writeFileSync(
      path.join(OUT, file),
      `${JSON.stringify(cut(JSON.parse(await get(companyFactsUrl(cik)))))}\n`,
    );
  for (const [file, url] of Object.entries(XML))
    writeFileSync(path.join(OUT, file), await get(url));
  // NVIDIA's filing list, cut to the proxy, the three 13Gs and the Form 4 recorded above.
  const sub = JSON.parse(await get('https://data.sec.gov/submissions/CIK0001045810.json'));
  const keep = new Set([
    '0001045810-26-000036',
    ...Object.values(XML).map((u) =>
      u.split('/')[7].replace(/^(\d{10})(\d{2})(\d{6})$/, '$1-$2-$3'),
    ),
  ]);
  const recent = sub.filings.recent as Record<string, unknown[]>;
  const rows = recent.accessionNumber
    .map((a, i) => (keep.has(a as string) ? i : -1))
    .filter((i) => i >= 0);
  const cutRecent = Object.fromEntries(
    Object.entries(recent).map(([k, v]) => [k, rows.map((i) => v[i])]),
  );
  writeFileSync(
    path.join(OUT, 'submissions-nvda.json'),
    `${JSON.stringify({ cik: sub.cik, name: sub.name, filings: { recent: cutRecent } })}\n`,
  );
  for (const [slug, url] of Object.entries(PROXIES)) {
    const doc = await readDocument(url);
    if (!doc.ok) throw new Error(`${slug}: ${doc.reason}`);
    writeFileSync(path.join(OUT, `proxy-${slug}.txt`), `${ownershipExcerpt(squash(doc.text))}\n`);
  }
  console.log(`fixtures written to ${OUT}`);
}

async function backfill() {
  const prices = await fetchAllPrices({ cacheDir: null });
  console.log(
    `prices: ${prices.tickers} listings, ${prices.pointsNew} new, ${prices.pointsRevised} revised, ${prices.failed} failed`,
  );
  for (const e of prices.errors) console.log(`  ${e}`);
  const facts = await refreshMarketFacts({ deadline: Date.now() + 30 * 60 * 1000 });
  console.log(`facts: ${facts.looked} looked, ${facts.stored} stored, ${facts.failed} failed`);
  console.log(`seed: ${MARKET_SEED.map((c) => tickerKey(c.ticker)).join(', ')}`);
}

async function main() {
  const mode = process.argv[2];
  if (mode === '--fixtures') await fixtures();
  else if (mode === '--backfill') await backfill();
  else console.log('Usage: market-data.ts --backfill | --fixtures');
  process.exit(0);
}

void main();
