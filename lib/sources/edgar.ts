/**
 * SEC EDGAR (free; a descriptive user agent is the whole price — see
 * hosts.ts for the exact string SEC accepts). Three calls:
 *
 *   company_tickers.json      → the filer's CIK, by ticker or exact name
 *   submissions/CIK….json     → its recent filings (form, accession, document)
 *   Archives/…/<document>     → the filing text, read through lib/sources/document
 *
 * From the newest 10-K / 20-F it reads customer sentences; from the newest
 * DEF 14A (else the annual report) the "5% or greater" holder rows
 * (edgar-text.ts). A customer that is an entity becomes `filer supplies
 * customer`; a holder that is an entity becomes `holder owns filer` with the
 * stated per cent. Every other hit is listed as a record and skipped.
 */
import type { SubmittedBy } from '@/lib/entry/candidate';
import { squash } from '@/lib/event-rules';
import { customerHits, holderHits, type NameHit } from './edgar-text';
import { nameKey } from './endpoints';
import { readDocument, type DocumentDeps, type DocumentRead } from './document';
import { finalise, type AdapterResult, type Draft, type Skipped } from './proposal';

export const SEC_TICKERS = 'https://www.sec.gov/files/company_tickers.json';
export const submissionsUrl = (cik: number) =>
  `https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`;

export interface Filing {
  form: string;
  accession: string;
  filed: string;
  /** The period the filing is for; falls back to the filing date. */
  period: string;
  url: string;
}

export interface EdgarRecord {
  kind: 'customer' | 'holder';
  filing: Filing;
  hit: NameHit;
}

async function json<T>(url: string, deps: DocumentDeps): Promise<T> {
  const doc = await readDocument(url, deps);
  if (!doc.ok) throw new Error(`EDGAR: ${doc.reason}`);
  return JSON.parse(doc.text) as T;
}

/** The CIK for a ticker or an exact company name ("MP Materials" matches "MP Materials Corp. / DE"). */
export async function findCik(tickerOrName: string, deps: DocumentDeps = {}): Promise<number[]> {
  const rows = Object.values(
    await json<Record<string, { cik_str: number; ticker: string; title: string }>>(
      SEC_TICKERS,
      deps,
    ),
  );
  const byTicker = rows.filter((r) => r.ticker.toUpperCase() === tickerOrName.toUpperCase());
  if (byTicker.length) return [...new Set(byTicker.map((r) => r.cik_str))];
  const key = nameKey(tickerOrName);
  return [
    ...new Set(
      rows
        .filter((r) => nameKey(r.title.replace(/\s*\/\s*[A-Z]{2}\s*$/, '')) === key)
        .map((r) => r.cik_str),
    ),
  ];
}

export async function listFilings(cik: number, deps: DocumentDeps = {}): Promise<Filing[]> {
  const sub = await json<{
    filings: {
      recent: Record<
        'form' | 'accessionNumber' | 'filingDate' | 'reportDate' | 'primaryDocument',
        string[]
      >;
    };
  }>(submissionsUrl(cik), deps);
  const r = sub.filings.recent;
  return r.form.map((form, i) => ({
    form,
    accession: r.accessionNumber[i],
    filed: r.filingDate[i],
    period: r.reportDate[i] || r.filingDate[i],
    url: `https://www.sec.gov/Archives/edgar/data/${cik}/${r.accessionNumber[i].replace(/-/g, '')}/${r.primaryDocument[i]}`,
  }));
}

const ANNUAL = ['10-K', '20-F', '40-F'];
const PROXY = ['DEF 14A'];

export async function fetchEdgar(cik: number, deps: DocumentDeps = {}) {
  const filings = await listFilings(cik, deps);
  const annual = filings.find((f) => ANNUAL.includes(f.form));
  const proxy = filings.find((f) => PROXY.includes(f.form)) ?? annual;
  const docs = new Map<string, DocumentRead>();
  const records: EdgarRecord[] = [];
  for (const [filing, kind] of [
    [annual, 'customer'],
    [proxy, 'holder'],
  ] as const) {
    if (!filing) continue;
    let doc = docs.get(filing.url);
    if (!doc) {
      doc = await readDocument(filing.url, deps);
      // Quotes are cut from, and checked against, the squashed text.
      if (doc.ok) doc = { ...doc, text: squash(doc.text) };
      docs.set(filing.url, doc);
    }
    if (!doc.ok) continue;
    const hits = kind === 'customer' ? customerHits(doc.text) : holderHits(doc.text);
    for (const hit of hits) records.push({ kind, filing, hit });
  }
  return { filings, records, docs };
}

export function edgarDrafts(filer: string, records: readonly EdgarRecord[]) {
  const drafts: Draft[] = [];
  const skipped: Skipped[] = [];
  const seen = new Set<string>();
  for (const { kind, filing, hit } of records) {
    const label = `${filing.form} ${filing.period}: ${kind} "${hit.name}"${hit.percent !== undefined ? ` ${hit.percent}%` : ''}`;
    if (!hit.endpoint)
      skipped.push({ record: label, reason: hit.reason ?? 'not an entity on the site' });
    else if (!hit.quote)
      skipped.push({ record: label, reason: 'sentence outside the 20–400 character quote bounds' });
    else if (hit.endpoint === filer)
      skipped.push({ record: label, reason: 'names the filer itself' });
    else {
      const from = kind === 'customer' ? filer : hit.endpoint;
      const to = kind === 'customer' ? hit.endpoint : filer;
      const key = `${from}|${to}|${filing.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      drafts.push({
        from,
        to,
        type: kind === 'customer' ? 'supplies' : 'owns',
        grade: 'stated',
        // A proxy's holder table is dated near its filing, not the fiscal year it reports on.
        asOf: kind === 'holder' && PROXY.includes(filing.form) ? filing.filed : filing.period,
        url: filing.url,
        quote: hit.quote,
        locator: `${filing.form} filed ${filing.filed}`,
        ...(kind === 'holder' && hit.percent
          ? { share: { value: hit.percent, unit: 'percent' as const } }
          : {}),
        label,
      });
    }
  }
  return { drafts, skipped };
}

export async function runEdgar(
  cik: number,
  filer: string,
  submittedBy: SubmittedBy,
  deps: DocumentDeps = {},
): Promise<AdapterResult<EdgarRecord>> {
  const { records, docs } = await fetchEdgar(cik, deps);
  const { drafts, skipped } = edgarDrafts(filer, records);
  const done = finalise(drafts, { adapter: 'edgar', docs, submittedBy, ceiling: 'stated' });
  return { adapter: 'edgar', records, rows: done.rows, skipped: [...skipped, ...done.skipped] };
}
