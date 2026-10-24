/**
 * GLEIF: Legal Entity Identifier records and their Level 2 relationship
 * records (free, no key; api.gleif.org). A relationship record says, in a
 * filed and validated form, that one legal entity is accounting-consolidated
 * by another — `IS_DIRECTLY_CONSOLIDATED_BY` or `IS_ULTIMATELY_CONSOLIDATED_BY`.
 * That maps exactly onto `parent owns child`, stated, with no share (GLEIF
 * records none). The quote is the record's own `startNode … status` span and
 * the source is the relationship record's URL.
 *
 * Identity is never guessed: the caller names the LEI (`--lei`), and each end
 * becomes an endpoint only when one of its GLEIF names is an entity's name.
 * `searchLei` lists LEIs for a name so a person (or model) can choose one.
 */
import type { SubmittedBy } from '@/lib/entry/candidate';
import { companyEndpoint } from './endpoints';
import { readDocument, type DocumentDeps, type DocumentRead } from './document';
import { finalise, type AdapterResult, type Draft, type Skipped } from './proposal';
import { jsonSpan } from './text';

export const GLEIF_API = 'https://api.gleif.org/api/v1';

interface LeiData {
  id: string;
  attributes: {
    entity: {
      legalName: { name: string };
      otherNames?: { name: string }[];
      transliteratedOtherNames?: { name: string }[];
      legalAddress?: { country?: string };
    };
  };
}

export interface GleifRelationRecord {
  childLei: string;
  parentLei: string;
  level: 'direct' | 'ultimate';
  status: string;
  /** YYYY-MM-DD of the golden copy the record was read from. */
  asOf: string;
  url: string;
  childNames: string[];
  parentNames: string[];
}

function names(d: LeiData): string[] {
  const e = d.attributes.entity;
  return [
    e.legalName.name,
    ...(e.otherNames ?? []).map((n) => n.name),
    ...(e.transliteratedOtherNames ?? []).map((n) => n.name),
  ];
}

async function read(url: string, deps: DocumentDeps): Promise<DocumentRead | null> {
  const doc = await readDocument(url, deps);
  if (doc.ok) return doc;
  if (/answered 404/.test(doc.reason)) return null;
  throw new Error(`GLEIF: ${doc.reason}`);
}

async function leiNames(lei: string, deps: DocumentDeps): Promise<string[]> {
  const doc = await read(`${GLEIF_API}/lei-records/${lei}`, deps);
  return doc?.ok ? names((JSON.parse(doc.text) as { data: LeiData }).data) : [];
}

/** LEIs whose names match `name`, for a person to choose from. */
export async function searchLei(name: string, deps: DocumentDeps = {}) {
  const url = `${GLEIF_API}/lei-records?filter%5Bfulltext%5D=${encodeURIComponent(name)}&page%5Bsize%5D=10`;
  const doc = await read(url, deps);
  if (!doc?.ok) return [];
  return (JSON.parse(doc.text) as { data: LeiData[] }).data.map((d) => ({
    lei: d.id,
    names: names(d),
    country: d.attributes.entity.legalAddress?.country ?? null,
  }));
}

async function parentRecord(
  childLei: string,
  level: 'direct' | 'ultimate',
  childNames: string[],
  deps: DocumentDeps,
  docs: Map<string, DocumentRead>,
): Promise<GleifRelationRecord | null> {
  const url = `${GLEIF_API}/lei-records/${childLei}/${level}-parent-relationship`;
  const doc = await read(url, deps);
  if (!doc?.ok) return null;
  docs.set(url, doc);
  const body = JSON.parse(doc.text) as {
    meta?: { goldenCopy?: { publishDate?: string } };
    data: { attributes: { relationship: { endNode: { id: string }; status: string } } };
  };
  const rel = body.data.attributes.relationship;
  return {
    childLei,
    parentLei: rel.endNode.id,
    level,
    status: rel.status,
    asOf: (body.meta?.goldenCopy?.publishDate ?? doc.fetchedAt).slice(0, 10),
    url,
    childNames,
    parentNames: await leiNames(rel.endNode.id, deps),
  };
}

/** The entity's direct and ultimate parents, and its direct children (up to `maxChildren`). */
export async function fetchGleifRelations(lei: string, deps: DocumentDeps = {}, maxChildren = 10) {
  const docs = new Map<string, DocumentRead>();
  const own = await leiNames(lei, deps);
  const records: GleifRelationRecord[] = [];
  for (const level of ['direct', 'ultimate'] as const) {
    const r = await parentRecord(lei, level, own, deps, docs);
    if (r && !records.some((x) => x.parentLei === r.parentLei)) records.push(r);
  }
  const kids = await read(
    `${GLEIF_API}/lei-records/${lei}/direct-children?page%5Bsize%5D=${maxChildren}`,
    deps,
  );
  for (const child of kids?.ok ? (JSON.parse(kids.text) as { data: LeiData[] }).data : []) {
    const r = await parentRecord(child.id, 'direct', names(child), deps, docs);
    if (r) records.push({ ...r, parentNames: own });
  }
  return { records, docs };
}

function endpointFor(all: string[]): { id: string | null; reason: string } {
  const ids = new Set<string>();
  for (const n of all) {
    const r = companyEndpoint(n);
    if (r.id) ids.add(r.id);
  }
  if (ids.size === 1) return { id: [...ids][0], reason: '' };
  if (ids.size > 1)
    return { id: null, reason: `names resolve to ${[...ids].join(', ')}; not choosing` };
  return {
    id: null,
    reason: `none of ${all.map((n) => `"${n}"`).join(', ')} is an entity on the site`,
  };
}

export function gleifDrafts(
  records: readonly GleifRelationRecord[],
  docs: ReadonlyMap<string, DocumentRead>,
  /** The caller's own statement of which entity an LEI is: `{ '5493…': 'company:x' }`. */
  identity: Readonly<Record<string, string>> = {},
) {
  const drafts: Draft[] = [];
  const skipped: Skipped[] = [];
  for (const r of records) {
    const label = `${r.parentLei} ${r.level}-consolidates ${r.childLei}`;
    const parent = identity[r.parentLei]
      ? { id: identity[r.parentLei], reason: '' }
      : endpointFor(r.parentNames);
    const child = identity[r.childLei]
      ? { id: identity[r.childLei], reason: '' }
      : endpointFor(r.childNames);
    const doc = docs.get(r.url);
    const quote = doc?.ok ? jsonSpan(doc.text, '"startNode":', '"status":') : null;
    if (r.status !== 'ACTIVE')
      skipped.push({ record: label, reason: `relationship status ${r.status}` });
    else if (!parent.id) skipped.push({ record: label, reason: `parent: ${parent.reason}` });
    else if (!child.id) skipped.push({ record: label, reason: `child: ${child.reason}` });
    else if (!quote) skipped.push({ record: label, reason: 'no quotable span in the record' });
    else
      drafts.push({
        from: parent.id,
        to: child.id,
        type: 'owns',
        grade: 'stated',
        asOf: r.asOf,
        url: r.url,
        quote,
        locator: `GLEIF relationship record (${r.level} parent)`,
        label,
      });
  }
  return { drafts, skipped };
}

export async function runGleif(
  lei: string,
  submittedBy: SubmittedBy,
  opts: { subject?: string } = {},
  deps: DocumentDeps = {},
): Promise<AdapterResult<GleifRelationRecord>> {
  const { records, docs } = await fetchGleifRelations(lei, deps);
  const { drafts, skipped } = gleifDrafts(
    records,
    docs,
    opts.subject ? { [lei]: opts.subject } : {},
  );
  const done = finalise(drafts, { adapter: 'gleif', docs, submittedBy, ceiling: 'stated' });
  return { adapter: 'gleif', records, rows: done.rows, skipped: [...skipped, ...done.skipped] };
}
