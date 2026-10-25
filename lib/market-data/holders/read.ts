/**
 * `holders(company)`: reads a company's EDGAR filing list, its newest proxy
 * statement, the structured Schedules 13G/13D filed about it since, and its
 * latest Forms 4, and builds the view (./build.ts). Cached per CIK for a day
 * (../snapshots.ts); a company that does not file with the SEC gets the
 * committed annual-report rows only, and says so.
 */
import { ownershipOf } from '@/config/substrata-ownership';
import { squash } from '@/lib/event-rules';
import { readDocument, type DocumentDeps } from '@/lib/sources/document';
import { listFilings, type Filing } from '@/lib/sources/edgar';
import { bodyText, sourceFetch } from '@/lib/sources/http';
import type { MarketCompany } from '../identity';
import { cachedSnapshot } from '../snapshots';
import { buildHolders, type HoldersInput, type HoldersView } from './build';
import { parseForm4 } from './insiders';
import { parseProxyTable } from './proxy';
import { SCHEDULE_FORMS, parseSchedule13Xml, rawXmlUrl } from './schedule13';

export type HoldersResult =
  (HoldersView & { fetchedAt: string }) | { unavailable: true; company: string; reason: string };

const DAY = 24 * 60 * 60 * 1000;
/** Bounded reads per company: one proxy, these many 13Gs and Form 4s. */
const MAX_SCHEDULES = 12;
const MAX_FORM4 = 6;

function fallbackRows(c: MarketCompany) {
  for (const slug of [c.slug, ...(c.pages ?? [])]) {
    const row = ownershipOf(slug);
    if (row?.holders.some((h) => h.share !== null)) return row.holders;
  }
  return [];
}

async function text(url: string, deps: DocumentDeps): Promise<string | null> {
  try {
    return bodyText(await sourceFetch(url, '*/*', deps));
  } catch {
    return null;
  }
}

/** The filings read for one CIK, as build.ts takes them. Exported for the backfill script. */
export async function gatherHolders(
  c: MarketCompany & { cik: number },
  deps: DocumentDeps,
): Promise<HoldersInput> {
  const filings: Filing[] = await listFilings(c.cik, deps);
  const proxyFiling = filings.find((f) => f.form === 'DEF 14A');
  let proxy: HoldersInput['proxy'] = null;
  if (proxyFiling) {
    const doc = await readDocument(proxyFiling.url, deps);
    const table = doc.ok ? parseProxyTable(squash(doc.text)) : null;
    if (table?.rows.length) proxy = { table, url: proxyFiling.url, filed: proxyFiling.filed };
  }
  const schedules: HoldersInput['schedules'] = [];
  const structured = filings.filter(
    (f) => SCHEDULE_FORMS.test(f.form) && f.url.endsWith('primary_doc.xml'),
  );
  for (const f of structured.slice(0, MAX_SCHEDULES)) {
    const url = rawXmlUrl(f.url);
    const xml = await text(url, deps);
    const s = xml ? parseSchedule13Xml(xml) : null;
    // A company's filing list also holds 13Gs it filed about OTHER issuers.
    if (!s || s.issuerCik !== c.cik) continue;
    schedules.push({ s, url: f.url, filed: f.filed, filerCik: Number(f.accession.split('-')[0]) });
  }
  const insiders: HoldersInput['insiders'] = [];
  for (const f of filings.filter((x) => x.form === '4').slice(0, MAX_FORM4)) {
    const xml = await text(rawXmlUrl(f.url), deps);
    const parsed = xml ? parseForm4(xml) : null;
    if (parsed) insiders.push({ ...parsed, url: f.url });
  }
  return {
    company: c.name,
    proxy,
    schedules,
    insiders,
    fallback: fallbackRows(c),
    fallbackFrom: 'Annual report',
    multiClass: c.multiClass ?? false,
  };
}

export async function holders(
  c: MarketCompany,
  deps: DocumentDeps = {},
  maxAgeMs = DAY,
): Promise<HoldersResult> {
  const d: DocumentDeps = { cacheDir: null, ...deps };
  if (!c.cik) {
    const view = buildHolders({
      company: c.name,
      proxy: null,
      schedules: [],
      insiders: [],
      fallback: fallbackRows(c),
      fallbackFrom: 'Annual report',
    });
    return {
      ...view,
      notes: [
        ...view.notes,
        `${c.name} does not file with the SEC, so no 13G, 13D, proxy or Form 4 exists for it; the rows are read off its own annual report.`,
      ],
      fetchedAt: new Date().toISOString(),
    };
  }
  const cik = c.cik;
  const snap = await cachedSnapshot<HoldersView>('holders', String(cik), maxAgeMs, async () => {
    try {
      return buildHolders(await gatherHolders({ ...c, cik }, d));
    } catch {
      return null;
    }
  });
  return snap
    ? { ...snap.data, fetchedAt: snap.fetchedAt }
    : {
        unavailable: true,
        company: c.name,
        reason: 'SEC EDGAR could not be read just now; nothing is stored for it yet.',
      };
}
