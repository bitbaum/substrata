/**
 * UN Comtrade, public preview API — no key. Checked 2026-10-24 from the
 * sandbox: `comtradeapi.un.org/public/v1/preview/...` answers without a
 * subscription key (up to 500 rows a call), and the partner reference file
 * maps its M49 codes to ISO 3166 alpha-2.
 *
 * One record is "reporter exported HS code to partner in period, net weight
 * and value". It maps exactly onto `country:<reporter> ships_to
 * country:<partner>` with the net weight as the volume. To make the quote
 * unambiguous each partner is read from its own URL (`partnerCode=` in the
 * query), whose one record is quoted from `"cmdCode"` through `"netWgt"`.
 * A weight Comtrade marks as estimated is a `lead`.
 */
import { countryByIso2 } from './endpoints';
import { readDocument, type DocumentDeps, type DocumentRead } from './document';
import { finalise, type AdapterResult, type Draft, type Skipped } from './proposal';
import { jsonSpan } from './text';
import type { SubmittedBy } from '@/lib/entry/candidate';

export const COMTRADE_BASE = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS';
export const COMTRADE_PARTNERS =
  'https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json';

/** One HS code per resource: the form a country mostly ships it in. Edit with a reason. */
export const HS_FOR_RESOURCE: Record<string, { code: string; what: string }> = {
  uranium: { code: '284410', what: 'natural uranium and its compounds' },
  copper: { code: '7403', what: 'refined copper, unwrought' },
  lithium: { code: '283691', what: 'lithium carbonates' },
  nickel: { code: '7502', what: 'unwrought nickel' },
  cobalt: { code: '2605', what: 'cobalt ores and concentrates' },
  'rare-earths': { code: '2846', what: 'rare-earth metal compounds' },
  graphite: { code: '2504', what: 'natural graphite' },
  tin: { code: '8001', what: 'unwrought tin' },
  iron: { code: '2601', what: 'iron ores and concentrates' },
  bauxite: { code: '2606', what: 'aluminium ores (bauxite)' },
  tungsten: { code: '2611', what: 'tungsten ores and concentrates' },
  coal: { code: '2701', what: 'coal' },
  oil: { code: '2709', what: 'crude petroleum oils' },
  'natural-gas': { code: '2711', what: 'petroleum gases' },
  gold: { code: '7108', what: 'gold, unwrought or semi-manufactured' },
  silver: { code: '7106', what: 'silver, unwrought or semi-manufactured' },
  phosphates: { code: '2510', what: 'natural calcium phosphates' },
};

export interface ComtradeQuery {
  reporterIso2: string;
  hs: string;
  period: string;
  /** How many partners, largest net weight first. Default 5. */
  top?: number;
}

export interface ComtradeRecord {
  reporterIso2: string;
  partnerIso2: string | null;
  partnerCode: number;
  period: string;
  hs: string;
  netWeightKg: number;
  valueUsd: number | null;
  estimated: boolean;
  url: string;
}

interface RawRow {
  partnerCode: number;
  netWgt: number | null;
  isNetWgtEstimated: boolean;
  primaryValue: number | null;
}

async function json<T>(url: string, deps: DocumentDeps): Promise<{ doc: DocumentRead; data: T }> {
  const doc = await readDocument(url, deps);
  if (!doc.ok) throw new Error(`Comtrade: ${doc.reason}`);
  return { doc, data: JSON.parse(doc.text) as T };
}

export function comtradeUrl(reporterCode: number, q: ComtradeQuery, partnerCode?: number): string {
  const p = new URLSearchParams({
    reporterCode: String(reporterCode),
    period: q.period,
    cmdCode: q.hs,
    flowCode: 'X',
  });
  if (partnerCode !== undefined) p.set('partnerCode', String(partnerCode));
  return `${COMTRADE_BASE}?${p.toString()}`;
}

/** Exports of `hs` from the reporter in `period`, per partner, each with its own fetched document. */
export async function fetchComtradeExports(
  q: ComtradeQuery,
  deps: DocumentDeps = {},
): Promise<{ records: ComtradeRecord[]; docs: Map<string, DocumentRead> }> {
  const ref = await json<{
    results: { PartnerCode: number; PartnerCodeIsoAlpha2?: string; isGroup: boolean }[];
  }>(COMTRADE_PARTNERS, deps);
  const iso = new Map(
    ref.data.results
      .filter((r) => r.PartnerCodeIsoAlpha2)
      .map((r) => [r.PartnerCode, r.PartnerCodeIsoAlpha2!.toLowerCase()]),
  );
  const reporterCode = [...iso].find(([, i]) => i === q.reporterIso2.toLowerCase())?.[0];
  if (reporterCode === undefined)
    throw new Error(`Comtrade has no reporter code for ${q.reporterIso2}.`);
  const all = await json<{ data: RawRow[] }>(comtradeUrl(reporterCode, q), deps);
  const partners = all.data.data
    .filter((r) => r.partnerCode !== 0 && (r.netWgt ?? 0) > 0)
    .sort((a, b) => (b.netWgt ?? 0) - (a.netWgt ?? 0))
    .slice(0, q.top ?? 5);
  const docs = new Map<string, DocumentRead>();
  const records: ComtradeRecord[] = [];
  for (const p of partners) {
    const url = comtradeUrl(reporterCode, q, p.partnerCode);
    const one = await json<{ data: RawRow[] }>(url, deps);
    docs.set(url, one.doc);
    const row = one.data.data[0];
    if (!row) continue;
    records.push({
      reporterIso2: q.reporterIso2.toLowerCase(),
      partnerIso2: iso.get(row.partnerCode) ?? null,
      partnerCode: row.partnerCode,
      period: q.period,
      hs: q.hs,
      netWeightKg: row.netWgt ?? 0,
      valueUsd: row.primaryValue,
      estimated: row.isNetWgtEstimated,
      url,
    });
  }
  return { records, docs };
}

/** Drafts for the records whose two countries are on the site; the rest skipped with the reason. */
export function comtradeDrafts(
  records: readonly ComtradeRecord[],
  docs: ReadonlyMap<string, DocumentRead>,
) {
  const drafts: Draft[] = [];
  const skipped: Skipped[] = [];
  for (const r of records) {
    const label = `${r.reporterIso2} → partner ${r.partnerCode} (${r.partnerIso2 ?? '?'}), HS ${r.hs}, ${r.period}`;
    const from = countryByIso2(r.reporterIso2);
    const to = r.partnerIso2 ? countryByIso2(r.partnerIso2) : undefined;
    const doc = docs.get(r.url);
    const quote = doc?.ok ? jsonSpan(doc.text, '"cmdCode":', '"netWgt":') : null;
    if (!from || !to) skipped.push({ record: label, reason: 'a country the site has no page for' });
    else if (!quote)
      skipped.push({
        record: label,
        reason: 'no quotable span of 20–400 characters in the record',
      });
    else
      drafts.push({
        from,
        to,
        type: 'ships_to',
        grade: r.estimated ? 'lead' : 'stated',
        asOf: r.period,
        url: r.url,
        quote,
        locator: `UN Comtrade record, partner code ${r.partnerCode}`,
        volume: { value: r.netWeightKg, unit: 'kg', period: r.period, commodity: `HS ${r.hs}` },
        label,
      });
  }
  return { drafts, skipped };
}

export async function runComtrade(
  q: ComtradeQuery,
  submittedBy: SubmittedBy,
  deps: DocumentDeps = {},
): Promise<AdapterResult<ComtradeRecord>> {
  const { records, docs } = await fetchComtradeExports(q, deps);
  const { drafts, skipped } = comtradeDrafts(records, docs);
  const done = finalise(drafts, { adapter: 'comtrade', docs, submittedBy, ceiling: 'stated' });
  return { adapter: 'comtrade', records, rows: done.rows, skipped: [...skipped, ...done.skipped] };
}
