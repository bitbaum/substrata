/**
 * Wikidata industry classes → theme evidence. One SPARQL query per theme
 * class (config/universe-sources.ts WIKIDATA_INDUSTRIES): companies whose
 * "industry" (P452) is that class and that carry an ISIN (P946) or a stock
 * exchange (P414), so the row has an identity a registry can confirm.
 *
 * Wikidata is edited by anyone. A row from here counts for the theme test and
 * gives a QID; it never carries a size, so a company found only here is
 * "considered, not admitted" until a cited figure clears a floor.
 */
import { WIKIDATA_INDUSTRIES } from '@/config/universe-sources';
import type { SubmittedBy } from '@/lib/entry/candidate';
import type { UniverseRow } from '@/lib/universe/types';
import { bodyText, sourceFetch, type FetchDeps } from './http';
import { bindingSpan } from './registry-ids';
import { WIKIDATA_SPARQL } from './wikidata';

const SUBMITTED: SubmittedBy = {
  agent: 'universe-adapter',
  model: 'deterministic-adapter',
  runId: 'universe',
};

export const industryQuery = (qid: string) =>
  `SELECT ?item ?itemLabel ?isin ?iso WHERE { ?item wdt:P452 wd:${qid} . { ?item wdt:P946 ?isin } UNION { ?item wdt:P414 ?x } OPTIONAL { ?item wdt:P17/wdt:P297 ?iso } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 400`;

export interface IndustryMember {
  qid: string;
  label: string;
  isin?: string;
  iso2?: string;
  industry: string;
  url: string;
  quote: string;
  fetchedAt: string;
}

export async function industryMembers(deps: FetchDeps = {}): Promise<IndustryMember[]> {
  const out: IndustryMember[] = [];
  for (const { qid } of WIKIDATA_INDUSTRIES) {
    const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(industryQuery(qid))}`;
    let got;
    try {
      got = await sourceFetch(url, 'application/sparql-results+json', deps);
    } catch {
      continue;
    }
    const text = bodyText(got);
    const bindings = (
      JSON.parse(text) as {
        results: { bindings: Record<string, { value: string } | undefined>[] };
      }
    ).results.bindings;
    const byItem = new Map<string, IndustryMember>();
    for (const b of bindings) {
      const item = b.item!.value.split('/').pop()!;
      const label = b.itemLabel?.value ?? item;
      if (/^Q\d+$/.test(label)) continue; // no English label: nothing a reader could check by name
      const prior = byItem.get(item);
      byItem.set(item, {
        qid: item,
        label,
        isin: prior?.isin ?? b.isin?.value,
        iso2: prior?.iso2 ?? b.iso?.value,
        industry: qid,
        url,
        quote: prior?.quote ?? bindingSpan(text, b.item!.value),
        fetchedAt: got.fetchedAt,
      });
    }
    out.push(...byItem.values());
  }
  return out;
}

/** The row's quote is the query's own result binding for the item. */
export function industryRow(slug: string, m: IndustryMember, readOn: string): UniverseRow {
  const cls = WIKIDATA_INDUSTRIES.find((w) => w.qid === m.industry)!;
  return {
    company: slug,
    name: m.label,
    ...(m.iso2 ? { country: m.iso2.toUpperCase() } : {}),
    family: 'registry',
    evidence: 'candidate',
    asOf: readOn,
    source: { url: m.url, quote: m.quote.slice(0, 400), readOn, locator: 'SPARQL result binding' },
    submittedBy: SUBMITTED,
    provenance: { adapter: 'wikidata-universe', fetchedAt: m.fetchedAt, url: m.url },
    establishes: {
      theme: cls.theme,
      themeBasis: 'industry-class',
      themeLabel: `Wikidata lists its industry as ${cls.label}`,
      ids: { qid: m.qid, ...(m.isin ? { isin: m.isin } : {}) },
    },
  };
}
