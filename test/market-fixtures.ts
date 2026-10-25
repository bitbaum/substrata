/**
 * Recorded market-data responses (test/fixtures/market/, written by
 * scripts/research/market-data.ts --fixtures) behind a `fetch` the readers
 * accept, so the tests read real bytes and never the network. Any URL not
 * recorded answers 404.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, 'fixtures', 'market');

export const fixture = (file: string) => readFileSync(path.join(DIR, file), 'utf8');

const SEC = 'https://www.sec.gov/Archives/edgar/data/1045810';

/** URL → [file, content type]. Yahoo answers both query1 and query2 the same. */
const ROUTES: Record<string, [string, string]> = {
  'https://query1.finance.yahoo.com/v8/finance/chart/NVDA?range=5y&interval=1d': [
    'yahoo-nvda-1y.json',
    'application/json',
  ],
  'https://query2.finance.yahoo.com/v8/finance/chart/NVDA?range=5y&interval=1d': [
    'yahoo-nvda-1y.json',
    'application/json',
  ],
  'https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json': [
    'companyfacts-nvda.json',
    'application/json',
  ],
  'https://data.sec.gov/api/xbrl/companyfacts/CIK0001046179.json': [
    'companyfacts-tsmc.json',
    'application/json',
  ],
  'https://data.sec.gov/submissions/CIK0001045810.json': [
    'submissions-nvda.json',
    'application/json',
  ],
  [`${SEC}/000104581026000036/nvda-20260512.htm`]: ['proxy-nvidia.txt', 'text/plain'],
  [`${SEC}/000010290926000426/primary_doc.xml`]: ['nvda-13g-vanguard-zero.xml', 'application/xml'],
  [`${SEC}/000210011926000017/primary_doc.xml`]: ['nvda-13g-vcm.xml', 'application/xml'],
  [`${SEC}/000104581026000062/primary_doc.xml`]: [
    'nvda-13g-filed-by-nvidia.xml',
    'application/xml',
  ],
  [`${SEC}/000119764726000011/wk-form4_1791579847.xml`]: ['nvda-form4.xml', 'application/xml'],
};

export const asked: string[] = [];

export const marketFetch: typeof globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  asked.push(url);
  const ua = new Headers(init?.headers).get('user-agent') ?? '';
  if (!/cato@orangecat\.ch/.test(ua)) return new Response('no agent', { status: 403 });
  const hit = ROUTES[url];
  if (!hit) return new Response('not recorded', { status: 404 });
  return new Response(fixture(hit[0]), { status: 200, headers: { 'content-type': hit[1] } });
};

/** The deps every market reader takes in a test: recorded bytes, no disk cache, no waiting. */
export const MARKET_DEPS = { fetch: marketFetch, cacheDir: null, sleep: async () => {} };
