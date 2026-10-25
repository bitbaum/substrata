/**
 * Registry identifiers for a company already found elsewhere, keyed by ISIN
 * (from a US CUSIP, lib/sources/etf-holdings.ts): its LEI from GLEIF (with the
 * legal-address country) and its Wikidata QID. Never by name — an ISIN is a
 * security's own number, so the match is exact or absent.
 */
import type { SubmittedBy } from '@/lib/entry/candidate';
import type { UniverseRow } from '@/lib/universe/types';
import { GLEIF_API } from './gleif';
import { bodyText, sourceFetch, type FetchDeps } from './http';
import { WIKIDATA_SPARQL } from './wikidata';

const SUBMITTED: SubmittedBy = {
  agent: 'universe-adapter',
  model: 'deterministic-adapter',
  runId: 'universe',
};

export const leiByIsinUrl = (isin: string) => `${GLEIF_API}/lei-records?filter%5Bisin%5D=${isin}`;

export interface LeiHit {
  isin: string;
  lei: string;
  name: string;
  country?: string;
  url: string;
  quote: string;
  fetchedAt: string;
}

export async function leiForIsin(isin: string, deps: FetchDeps = {}): Promise<LeiHit | null> {
  const url = leiByIsinUrl(isin);
  const got = await sourceFetch(url, 'application/vnd.api+json', deps);
  const text = bodyText(got);
  const data = (
    JSON.parse(text) as {
      data: {
        id: string;
        attributes: {
          entity: { legalName: { name: string }; legalAddress?: { country?: string } };
        };
      }[];
    }
  ).data;
  if (data.length !== 1) return null;
  const d = data[0];
  const at = text.indexOf(`"lei":"${d.id}"`);
  const end = text.indexOf('"language"', at);
  if (at < 0 || end < 0) return null;
  const quote = text.slice(at, end).replace(/,$/, '');
  return {
    isin,
    lei: d.id,
    name: d.attributes.entity.legalName.name,
    country: d.attributes.entity.legalAddress?.country,
    url,
    quote,
    fetchedAt: got.fetchedAt,
  };
}

export function leiRow(slug: string, hit: LeiHit, readOn: string): UniverseRow {
  return {
    company: slug,
    name: hit.name,
    ...(hit.country ? { country: hit.country.toUpperCase() } : {}),
    family: 'registry',
    evidence: 'candidate',
    asOf: readOn,
    source: { url: hit.url, quote: hit.quote.slice(0, 400), readOn },
    submittedBy: SUBMITTED,
    provenance: { adapter: 'registry-ids', fetchedAt: hit.fetchedAt, url: hit.url },
    establishes: { ids: { lei: hit.lei, isin: hit.isin } },
  };
}

export const qidQuery = (isins: string[]) =>
  `SELECT ?item ?isin ?label WHERE { VALUES ?isin { ${isins.map((i) => JSON.stringify(i)).join(' ')} } ?item wdt:P946 ?isin . OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") } }`;

/** The `{ … }` that encloses `index` in a JSON text (no braces inside its strings). */
function enclosing(text: string, index: number): string {
  let open = index;
  for (let depth = 0; open > 0; open--) {
    if (text[open] === '}') depth++;
    if (text[open] === '{' && depth-- === 0) break;
  }
  let close = index;
  for (let depth = 0; close < text.length; close++) {
    if (text[close] === '{') depth++;
    if (text[close] === '}' && depth-- === 0) break;
  }
  return text.slice(open, close + 1);
}

/**
 * The SPARQL result binding (the object holding every variable of one row)
 * that first mentions `value`, whitespace folded — the quote a reader finds
 * by opening the query URL.
 */
export function bindingSpan(text: string, value: string): string {
  const at = text.indexOf(value);
  if (at < 0) return '';
  const inner = enclosing(text, at);
  return enclosing(text, text.lastIndexOf(inner, at) - 1).replace(/\s+/g, ' ');
}

export interface QidHit {
  isin: string;
  qid: string;
  /** The item's English label, when it has one: how the company writes its name. */
  label?: string;
  url: string;
  quote: string;
  fetchedAt: string;
}

export async function qidsForIsins(isins: string[], deps: FetchDeps = {}): Promise<QidHit[]> {
  const hits: QidHit[] = [];
  for (let i = 0; i < isins.length; i += 80) {
    const chunk = isins.slice(i, i + 80);
    const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(qidQuery(chunk))}`;
    let got;
    try {
      got = await sourceFetch(url, 'application/sparql-results+json', deps);
    } catch {
      continue;
    }
    const text = bodyText(got);
    const bindings = (
      JSON.parse(text) as {
        results: {
          bindings: {
            item: { value: string };
            isin: { value: string };
            label?: { value: string };
          }[];
        };
      }
    ).results.bindings;
    const seen = new Map<string, number>();
    for (const b of bindings) seen.set(b.isin.value, (seen.get(b.isin.value) ?? 0) + 1);
    for (const b of bindings) {
      if (seen.get(b.isin.value) !== 1) continue; // two items for one ISIN: not ours to choose
      hits.push({
        isin: b.isin.value,
        qid: b.item.value.split('/').pop()!,
        ...(b.label ? { label: b.label.value } : {}),
        url,
        quote: bindingSpan(text, b.item.value),
        fetchedAt: got.fetchedAt,
      });
    }
  }
  return hits;
}

export function qidRow(slug: string, name: string, hit: QidHit, readOn: string): UniverseRow {
  return {
    company: slug,
    name: hit.label ?? name,
    family: 'registry',
    evidence: 'candidate',
    asOf: readOn,
    source: {
      url: hit.url,
      quote: hit.quote.slice(0, 400),
      readOn,
      locator: 'SPARQL result binding',
    },
    submittedBy: SUBMITTED,
    provenance: { adapter: 'registry-ids', fetchedAt: hit.fetchedAt, url: hit.url },
    establishes: { ids: { qid: hit.qid, isin: hit.isin } },
  };
}
