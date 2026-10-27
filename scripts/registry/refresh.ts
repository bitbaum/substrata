/**
 * Re-read the Wikidata record of every registered company that has a QID and
 * rewrite the fields that came from Wikidata (headquarters, country, website,
 * ticker, CIK, LEI). Rows from any other source are never touched. A field the
 * record no longer states (or states twice) is removed with its evidence row.
 *
 *   pnpm run company:refresh -- [slug …]
 *   pnpm run company:refresh -- --summaries   give every company with a QID and no "what it is" its Wikipedia
 *                                              lead sentence, found through the QID's own English sitelink
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  domainOf,
  httpFetch,
  leadQuote,
  wikiSummary,
  wikidataRecord,
  type Fetcher,
} from '../../lib/registry/resolve';
import type { Company, Evidence, Ids } from '../../lib/registry/schema';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const get: Fetcher = async (url) => {
  for (let i = 0; i < 5; i++) {
    const res = await httpFetch(url);
    if (res.status !== 429) {
      await sleep(Number(process.env.REGISTRY_DELAY ?? 1200));
      return res;
    }
    await sleep(8000 * (i + 1));
  }
  return httpFetch(url);
};

const FROM_WIKIDATA = (e: Evidence) => e.source.startsWith('https://www.wikidata.org/');
const OWNED = new Set(['hq', 'country', 'ids.domain', 'ids.ticker', 'ids.cik', 'ids.lei']);

async function refresh(file: string, today: string): Promise<string> {
  const c = JSON.parse(readFileSync(file, 'utf8')) as Company;
  if (!c.ids.qid) return `skip ${c.slug}: no QID`;
  const r = await wikidataRecord(c.ids.qid, get);
  if (!r) return `skip ${c.slug}: no record`;
  const owned = (e: Evidence) => OWNED.has(e.field) && FROM_WIKIDATA(e);
  const evidence = c.evidence.filter((e) => !owned(e));
  const keep = (f: string) => evidence.some((e) => e.field === f);
  const row = (field: string, what: string, value: string): Evidence => ({
    field,
    grade: 'registry',
    source: r.url,
    quote: `${r.label} (${r.qid}) — ${what}: ${value}`,
    readOn: today,
    asOf: today,
  });
  const ids: Ids = { ...c.ids };
  const next: Company = { ...c, ids };
  const had = (f: string) => c.evidence.some((e) => e.field === f && owned(e));
  if (had('hq') || !c.hq) {
    delete next.hq;
    if (r.hq && !keep('hq')) {
      next.hq = r.hq;
      evidence.push(row('hq', 'headquarters location', r.hq));
    }
  }
  if (had('country') || !c.country) {
    delete next.country;
    if (r.country && !keep('country')) {
      next.country = r.country;
      evidence.push(row('country', 'country (ISO 3166-1 alpha-2)', r.country));
    }
  }
  const setId = (
    k: 'domain' | 'ticker' | 'cik' | 'lei',
    value: string | undefined,
    what: string,
  ) => {
    if (!had(`ids.${k}`) && ids[k]) return;
    delete ids[k];
    if (value && !keep(`ids.${k}`)) {
      ids[k] = value;
      evidence.push(row(`ids.${k}`, what, value));
    }
  };
  setId('domain', domainOf(r.website), 'official website');
  if (r.ticker && r.exchange) {
    if (had('ids.ticker') || !ids.ticker) {
      delete ids.exchange;
      setId('ticker', r.ticker, `ticker symbol on ${r.exchange}`);
      if (ids.ticker) ids.exchange = r.exchange;
    }
  } else if (had('ids.ticker')) {
    delete ids.ticker;
    delete ids.exchange;
    evidence.splice(0, evidence.length, ...evidence.filter((e) => e.field !== 'ids.ticker'));
  }
  setId('cik', r.cik, 'SEC Central Index Key');
  setId('lei', r.lei?.length === 20 ? r.lei : undefined, 'Legal Entity Identifier');
  next.evidence = evidence;
  if (next.kind === 'public' && !(ids.ticker && ids.exchange)) next.kind = 'unclassified';
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  return `ok   ${c.slug}: ${next.hq ?? '-'} ${next.country ?? '-'}`;
}

/** The page Wikidata itself links for the QID, so the sentence is about this entity, not a namesake. */
async function summarize(file: string, today: string): Promise<string> {
  const c = JSON.parse(readFileSync(file, 'utf8')) as Company;
  if (c.summary || !c.ids.qid) return `skip ${c.slug}`;
  const res = await get(`https://www.wikidata.org/wiki/Special:EntityData/${c.ids.qid}.json`);
  if (!res.ok) return `skip ${c.slug}: no entity`;
  const j = (await res.json()) as {
    entities?: Record<string, { sitelinks?: { enwiki?: { title: string } } }>;
  };
  const title = j.entities?.[c.ids.qid]?.sitelinks?.enwiki?.title;
  if (!title) return `skip ${c.slug}: no English page`;
  const page = await wikiSummary(title, get);
  if (!page || page.qid !== c.ids.qid) return `skip ${c.slug}: page is another item`;
  const quote = leadQuote(page.extract);
  if (!/^[A-Z0-9]/.test(quote) || quote.length < 20)
    return `skip ${c.slug}: lead sentence unusable`;
  if (/\b(was|were) (an?|the) /.test(quote.split('. ')[0])) return `skip ${c.slug}: past tense`;
  c.summary = quote;
  c.evidence.push({
    field: 'summary',
    grade: 'reported',
    source: page.url,
    quote,
    readOn: today,
    asOf: today,
  });
  writeFileSync(file, JSON.stringify(c, null, 2) + '\n');
  return `ok   ${c.slug}`;
}

async function main() {
  const dir = path.join(process.cwd(), 'registry', 'companies');
  const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')));
  const today = new Date().toISOString().slice(0, 10);
  for (const f of readdirSync(dir).sort()) {
    if (only.size && !only.has(f.replace(/\.json$/, ''))) continue;
    const file = path.join(dir, f);
    console.log(
      await (process.argv.includes('--summaries') ? summarize(file, today) : refresh(file, today)),
    );
  }
}
void main();
