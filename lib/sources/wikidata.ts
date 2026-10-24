/**
 * Wikidata: "owned by" (P127), "parent organization" (P749), "operator"
 * (P137) and "country" (P17) for one item, and the organisations (not the
 * patents, which also carry "owned by") that name it as their owner or parent. SPARQL finds the statements; the quote is the claim
 * itself, cut from the item's entity JSON (`Special:EntityData/<Q>.json`),
 * which is also the row's source URL.
 *
 * Wikidata is edited by anyone, so a row from here is a `lead` — never
 * `stated` on its own. It reads `stated` only when a second, independent
 * source already says the same edge: a counted relation in the graph, or a
 * stated row another adapter proposed in the same run (`agrees`).
 * "Country" has no relation type in the closed set; it is reported, not written.
 */
import type { SubmittedBy } from '@/lib/entry/candidate';
import type { RelationType } from '@/lib/graph/types';
import { companyEndpoint, countryByIso2 } from './endpoints';
import { readDocument, type DocumentDeps, type DocumentRead } from './document';
import { finalise, type AdapterResult, type Draft, type Skipped } from './proposal';
import { QUOTE_MAX } from './text';

export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
export const entityDataUrl = (q: string) =>
  `https://www.wikidata.org/wiki/Special:EntityData/${q}.json`;

const PROPS: Record<string, { label: string; type: RelationType | null; owner: 'value' | 'item' }> =
  {
    P127: { label: 'owned by', type: 'owns', owner: 'value' },
    P749: { label: 'parent organization', type: 'owns', owner: 'value' },
    P137: { label: 'operator', type: 'operates', owner: 'value' },
    P17: { label: 'country', type: null, owner: 'value' },
  };

export interface WikidataStatement {
  /** The item carrying the claim, and the claim's value. */
  item: string;
  itemLabel: string;
  prop: keyof typeof PROPS;
  value: string;
  valueLabel: string;
  valueIso2: string | null;
}

const sparqlUrl = (query: string) =>
  `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`;

/** Items whose English label is exactly `label`, for a person to choose a QID from. */
export function labelQuery(label: string): string {
  return `SELECT ?item ?description WHERE { ?item rdfs:label ${JSON.stringify(label)}@en . OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "en") } } LIMIT 10`;
}

export function statementsQuery(q: string): string {
  return `SELECT ?item ?itemLabel ?prop ?value ?valueLabel ?iso WHERE {
  { BIND(wd:${q} AS ?item) VALUES ?p { wdt:P127 wdt:P749 wdt:P137 wdt:P17 } ?item ?p ?value . }
  UNION { BIND(wd:${q} AS ?value) VALUES ?p { wdt:P127 wdt:P749 } ?item ?p ?value .
          ?item wdt:P31/wdt:P279* wd:Q43229 . }
  BIND(STRAFTER(STR(?p), "direct/") AS ?prop)
  OPTIONAL { ?value wdt:P297 ?iso . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 60`;
}

type Binding = Record<string, { value: string } | undefined>;
const qid = (uri: string) => uri.split('/').pop()!;

export async function fetchWikidata(q: string, deps: DocumentDeps = {}) {
  const doc = await readDocument(sparqlUrl(statementsQuery(q)), deps);
  if (!doc.ok) throw new Error(`Wikidata: ${doc.reason}`);
  const bindings = (JSON.parse(doc.text) as { results: { bindings: Binding[] } }).results.bindings;
  const statements: WikidataStatement[] = bindings
    .filter((b) => b.prop && b.prop.value in PROPS)
    .map((b) => ({
      item: qid(b.item!.value),
      itemLabel: b.itemLabel?.value ?? '',
      prop: b.prop!.value as keyof typeof PROPS,
      value: qid(b.value!.value),
      valueLabel: b.valueLabel?.value ?? '',
      valueIso2: b.iso?.value ?? null,
    }));
  const docs = new Map<string, DocumentRead>();
  for (const item of [
    ...new Set(statements.filter((s) => PROPS[s.prop].type).map((s) => s.item)),
  ].slice(0, 10)) {
    docs.set(entityDataUrl(item), await readDocument(entityDataUrl(item), deps));
  }
  return { statements, docs };
}

/** The claim `prop → value` as it stands in the entity JSON, within the quote bounds. */
export function claimSpan(raw: string, prop: string, value: string): string | null {
  const from = `"property":"${prop}"`;
  const to = `"id":"${value}"`;
  for (let at = raw.indexOf(from); at >= 0; at = raw.indexOf(from, at + 1)) {
    const end = raw.indexOf(to, at);
    if (end < 0) return null;
    if (end + to.length - at <= QUOTE_MAX) return raw.slice(at, end + to.length);
  }
  return null;
}

/** Key of an edge, for `agrees`. */
export const edgeKey = (from: string, type: string, to: string) => `${from}|${type}|${to}`;

export function wikidataDrafts(
  statements: readonly WikidataStatement[],
  docs: ReadonlyMap<string, DocumentRead>,
  agrees: (key: string) => boolean,
  /** The caller's own statement of which entity the queried item is: `{ Q123: 'company:x' }`. */
  identity: Readonly<Record<string, string>> = {},
) {
  const resolve = (q: string, label: string) =>
    identity[q] ? { id: identity[q] } : companyEndpoint(label);
  const drafts: Draft[] = [];
  const skipped: Skipped[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const s of statements) {
    const p = PROPS[s.prop];
    const label = `${s.itemLabel} (${s.item}) ${p.label} ${s.valueLabel} (${s.value})`;
    if (!p.type) {
      const country = s.valueIso2 ? countryByIso2(s.valueIso2) : undefined;
      skipped.push({
        record: label,
        reason: `no relation type for "${p.label}"${country ? ` (${country})` : ''}`,
      });
      continue;
    }
    const item = resolve(s.item, s.itemLabel);
    const value = resolve(s.value, s.valueLabel);
    const url = entityDataUrl(s.item);
    const doc = docs.get(url);
    const quote = doc?.ok ? claimSpan(doc.text, s.prop, s.value) : null;
    const unresolved = item.id === null ? item : value.id === null ? value : null;
    if (unresolved && unresolved.id === null) {
      skipped.push({ record: label, reason: unresolved.reason });
      continue;
    }
    if (!quote) {
      skipped.push({
        record: label,
        reason: 'claim not found within 400 characters of the entity JSON',
      });
      continue;
    }
    // owned by / parent organization / operator: the value owns or operates the item.
    const from = value.id!;
    const to = item.id!;
    const agreed = agrees(edgeKey(from, p.type, to));
    drafts.push({
      from,
      to,
      type: p.type,
      grade: agreed ? 'stated' : 'lead',
      ...(agreed
        ? {}
        : {
            note: 'Wikidata is edited by anyone, and no second source in the graph says this yet.',
          }),
      asOf: today,
      url,
      quote,
      locator: `Wikidata ${s.item}, ${s.prop} (${p.label})`,
      label,
    });
  }
  return { drafts, skipped };
}

export async function runWikidata(
  q: string,
  submittedBy: SubmittedBy,
  opts: { subject?: string; agrees?: (key: string) => boolean } = {},
  deps: DocumentDeps = {},
): Promise<AdapterResult<WikidataStatement>> {
  const { statements, docs } = await fetchWikidata(q, deps);
  const identity = opts.subject ? { [q]: opts.subject } : {};
  const { drafts, skipped } = wikidataDrafts(
    statements,
    docs,
    opts.agrees ?? (() => false),
    identity,
  );
  const done = finalise(drafts, { adapter: 'wikidata', docs, submittedBy, ceiling: 'stated' });
  return {
    adapter: 'wikidata',
    records: statements,
    rows: done.rows,
    skipped: [...skipped, ...done.skipped],
  };
}
