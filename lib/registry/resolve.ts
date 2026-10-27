/**
 * Identity resolution for `company:add`: Wikipedia (REST) for what a company is
 * and its Wikidata id, Wikidata SPARQL for the structured record. Open
 * endpoints, a declared user agent, one request at a time. Every value comes
 * back with the URL that was opened and the literal text it came from.
 *
 * Licences: Wikidata is CC0; Wikipedia text is CC BY-SA, so only the lead
 * sentence is kept, attributed by its URL (docs/architecture/2026-10-28-frontier-registry.md §4.2).
 */
import type { Evidence, Ids } from './schema';

import { SITE } from '@/lib/site';

export const USER_AGENT = `substrata-registry/1.0 (${SITE.url})`;

export type Fetcher = (
  url: string,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export const httpFetch: Fetcher = (url) =>
  fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });

export interface WikiPage {
  title: string;
  url: string;
  description?: string;
  extract: string;
  qid?: string;
}

interface SummaryJson {
  type?: string;
  title?: string;
  description?: string;
  extract?: string;
  wikibase_item?: string;
  content_urls?: { desktop?: { page?: string } };
}

export async function wikiSummary(
  title: string,
  get: Fetcher = httpFetch,
): Promise<WikiPage | null> {
  const res = await get(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`,
  );
  if (!res.ok) return null;
  const j = (await res.json()) as SummaryJson;
  if (!j.extract || j.type === 'disambiguation') return null;
  return {
    title: j.title ?? title,
    url:
      j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    description: j.description,
    extract: j.extract,
    qid: j.wikibase_item,
  };
}

/** The first sentence(s) of an extract, at most `max` characters, cut at a sentence end. */
export function leadQuote(extract: string, max = 380): string {
  const flat = extract.replace(/\s+/g, ' ').trim();
  const sentences = flat.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [flat];
  let out = '';
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out = `${out}${s}`;
    if (out.trim().length >= 60) break;
  }
  return (out || flat.slice(0, max)).trim();
}

export interface WikidataRecord {
  qid: string;
  url: string;
  hq?: string;
  country?: string;
  website?: string;
  ticker?: string;
  exchange?: string;
  isin?: string;
  cik?: string;
  lei?: string;
  parentQid?: string;
  parent?: string;
  label: string;
}

/**
 * One deterministic row: aggregates (MIN) instead of LIMIT 1, so a company with several
 * headquarters or listings never mixes one's country with another's, and the pairs
 * (headquarters and its country; ticker and its exchange) are chosen together.
 */
function sparql(qid: string): string {
  return `SELECT (SAMPLE(?lab) AS ?l) (MIN(CONCAT(?hqLab, "|", COALESCE(?cch, ""))) AS ?hq) (MIN(?ccc) AS ?own) (COUNT(DISTINCT ?hqLab) AS ?nhq) (COUNT(DISTINCT ?ccc) AS ?nown)
  (MIN(?s) AS ?site) (MIN(CONCAT(?t, "|", COALESCE(?exLab, ""))) AS ?te) (MIN(?i) AS ?isin) (MIN(?k) AS ?cik)
  (MIN(?g) AS ?lei) (MIN(CONCAT(STR(?pq), "|", ?pl)) AS ?par) WHERE {
  BIND(wd:${qid} AS ?c)
  ?c rdfs:label ?lab FILTER(lang(?lab)="en")
  OPTIONAL { ?c wdt:P159 ?h . ?h rdfs:label ?hqLab FILTER(lang(?hqLab)="en") OPTIONAL { ?h wdt:P17 ?co . ?co wdt:P297 ?cch } }
  OPTIONAL { ?c wdt:P17 ?co2 . ?co2 wdt:P297 ?ccc }
  OPTIONAL { ?c wdt:P856 ?s }
  OPTIONAL { ?c p:P249 ?ts . ?ts ps:P249 ?t . OPTIONAL { ?ts pq:P414 ?ex . ?ex rdfs:label ?exLab FILTER(lang(?exLab)="en") } }
  OPTIONAL { ?c wdt:P946 ?i }
  OPTIONAL { ?c wdt:P5531 ?k }
  OPTIONAL { ?c wdt:P1278 ?g }
  OPTIONAL { ?c wdt:P749 ?pq . ?pq rdfs:label ?pl FILTER(lang(?pl)="en") }
}`;
}

export async function wikidataRecord(
  qid: string,
  get: Fetcher = httpFetch,
): Promise<WikidataRecord | null> {
  if (!/^Q\d+$/.test(qid)) return null;
  const res = await get(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql(qid))}`,
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { results?: { bindings?: Record<string, { value: string }>[] } };
  const b = j.results?.bindings?.[0];
  if (!b) return null;
  const v = (k: string) => b[k]?.value || undefined;
  const [hq, hqCountry] = (v('hq') ?? '').split('|');
  const [ticker, exchange] = (v('te') ?? '').split('|');
  const [parQ, parLabel] = (v('par') ?? '').split('|');
  return {
    qid,
    url: `https://www.wikidata.org/wiki/${qid}`,
    label: v('l') ?? qid,
    // Several headquarters (or countries) on the item means Wikidata does not say which: a gap, not a pick.
    hq: hq && v('nhq') === '1' ? hq : undefined,
    country: (hq && v('nhq') === '1' && hqCountry
      ? hqCountry
      : v('nown') === '1'
        ? v('own')
        : undefined
    )?.toUpperCase(),
    website: v('site'),
    ticker: ticker || undefined,
    exchange: exchange || undefined,
    isin: v('isin'),
    cik: v('cik')?.replace(/^0+/, ''),
    lei: v('lei'),
    parentQid: parQ?.match(/Q\d+$/)?.[0],
    parent: parLabel || undefined,
  };
}

/** Wikidata statements as rendered text: the quote of a structured record. */
function statement(r: WikidataRecord, what: string, value: string): string {
  return `${r.label} (${r.qid}) — ${what}: ${value}`;
}

export function domainOf(url: string | undefined): string | undefined {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : undefined;
  } catch {
    return undefined;
  }
}

export interface Resolved {
  page: WikiPage;
  record: WikidataRecord | null;
  ids: Ids;
  evidence: Evidence[];
}

/** Resolve one Wikipedia title into identity + evidence rows (only what was verified). */
export async function resolveTitle(
  title: string,
  today: string,
  get: Fetcher = httpFetch,
): Promise<Resolved | null> {
  const page = await wikiSummary(title, get);
  if (!page) return null;
  const record = page.qid ? await wikidataRecord(page.qid, get) : null;
  const quote = leadQuote(page.extract);
  const evidence: Evidence[] = [
    { field: 'summary', grade: 'reported', source: page.url, quote, readOn: today, asOf: today },
  ];
  const ids: Ids = {};
  if (record) {
    const row = (field: string, what: string, value: string): Evidence => ({
      field,
      grade: 'registry',
      source: record.url,
      quote: statement(record, what, value),
      readOn: today,
      asOf: today,
    });
    ids.qid = record.qid;
    evidence.push(row('ids.qid', 'Wikidata item', record.qid));
    if (record.hq) evidence.push(row('hq', 'headquarters location', record.hq));
    if (record.country)
      evidence.push(row('country', 'country (ISO 3166-1 alpha-2)', record.country));
    const domain = domainOf(record.website);
    if (domain) {
      ids.domain = domain;
      evidence.push(row('ids.domain', 'official website', record.website!));
    }
    if (record.ticker && record.exchange) {
      ids.ticker = record.ticker;
      ids.exchange = record.exchange;
      evidence.push(row('ids.ticker', `ticker symbol on ${record.exchange}`, record.ticker));
    }
    if (record.cik) {
      ids.cik = record.cik;
      evidence.push(row('ids.cik', 'SEC Central Index Key', record.cik));
    }
    if (record.lei && record.lei.length === 20) {
      ids.lei = record.lei;
      evidence.push(row('ids.lei', 'Legal Entity Identifier', record.lei));
    }
    if (record.isin && record.isin.length === 12) ids.isin = record.isin;
  }
  return { page, record, ids, evidence };
}
