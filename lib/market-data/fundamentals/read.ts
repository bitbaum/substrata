/**
 * `fundamentals(company)`: the XBRL series for a seed company, or why there
 * are none — a typed `unavailable`, never a blank.
 *
 * Coverage, checked 2026-10-25: the SEC's company-facts API holds tagged
 * statements for every seed company that files 10-K/10-Q (US GAAP) and for
 * the foreign filers that file a 20-F or 40-F in XBRL — TSMC (IFRS, TWD),
 * ASML (US GAAP, EUR), Rio Tinto (IFRS, USD), Cameco (IFRS, CAD). Foreign
 * filers' quarters go on Form 6-K, which carries no XBRL, so they have annual
 * figures only. Siemens Energy and Air Liquide have SEC registrant ids (ADR
 * programmes) but no company facts (the API answers 404). ASM International,
 * Tokyo Electron, Lynas and Kazatomprom do not file with the SEC at all;
 * their annual reports are PDFs at home, not quoted here — figures from them
 * belong in the corpus with a page locator, through scripts/research/add.ts.
 */
import { bodyText, sourceFetch, type FetchDeps } from '@/lib/sources/http';
import type { MarketCompany } from '../identity';
import { cachedSnapshot } from '../snapshots';
import { allMetrics, companyFactsUrl, type CompanyFacts, type MetricResult } from './xbrl';

export interface Fundamentals {
  cik: number;
  entityName: string;
  source: { name: string; url: string };
  /** When the company facts were read (ISO). */
  fetchedAt: string;
  metrics: MetricResult[];
  /** Said when a whole class of figures is missing for a structural reason. */
  notes: string[];
}

export interface FundamentalsUnavailable {
  unavailable: true;
  company: string;
  reason: string;
}

export type FundamentalsResult = Fundamentals | FundamentalsUnavailable;

const DAY = 24 * 60 * 60 * 1000;

/** Pure: company facts JSON → what every surface shows. */
export function buildFundamentals(cf: CompanyFacts, fetchedAt: string): Fundamentals {
  const metrics = allMetrics(cf);
  const series = metrics.filter((m) => !('unavailable' in m));
  const annualForms = new Set(
    series.flatMap((m) => ('annual' in m ? m.annual.map((p) => p.form) : [])),
  );
  const foreign = [...annualForms].some((f) => /^(20-F|40-F)/.test(f));
  const notes = [
    ...(foreign && series.every((m) => 'quarterly' in m && m.quarterly.length === 0)
      ? [
          'A foreign private issuer: its quarterly and half-year results are filed on Form 6-K, which carries no XBRL, so only annual figures are here.',
        ]
      : []),
    'Money is in the filer’s reporting currency, as tagged; nothing is converted. Fourth quarters are not filed as quarters and are not derived.',
  ];
  return {
    cik: cf.cik,
    entityName: cf.entityName,
    source: { name: 'SEC EDGAR XBRL company facts', url: companyFactsUrl(cf.cik) },
    fetchedAt,
    metrics,
    notes,
  };
}

function noSec(c: MarketCompany): FundamentalsUnavailable {
  return {
    unavailable: true,
    company: c.name,
    reason: `${c.name} does not file financial statements with the SEC, and no other free official source publishes its figures in machine-readable form; its annual report (${c.home ?? `listed as ${c.ticker.symbol} on ${c.ticker.exchange}`}) is a PDF not read here.`,
  };
}

/** Read and compute; null on a transient failure (the caller keeps an older snapshot). */
async function compute(
  c: MarketCompany & { cik: number },
  deps: FetchDeps,
): Promise<FundamentalsResult | null> {
  try {
    const fetched = await sourceFetch(companyFactsUrl(c.cik), 'application/json', {
      cacheDir: null,
      ...deps,
    });
    return buildFundamentals(JSON.parse(bodyText(fetched)) as CompanyFacts, fetched.fetchedAt);
  } catch (error) {
    if (error instanceof Error && /answered 404/.test(error.message))
      return {
        unavailable: true,
        company: c.name,
        reason: `The SEC holds no XBRL financial data for ${c.name} (company facts for CIK ${c.cik} answer 404): it is registered for its depositary receipts but files no tagged statements. Not available from a free official source.`,
      };
    return null;
  }
}

export async function fundamentals(
  c: MarketCompany,
  deps: FetchDeps = {},
  maxAgeMs = DAY,
): Promise<FundamentalsResult> {
  if (!c.cik) return noSec(c);
  const cik = c.cik;
  const snap = await cachedSnapshot<FundamentalsResult>('fundamentals', String(cik), maxAgeMs, () =>
    compute({ ...c, cik }, deps),
  );
  return (
    snap?.data ?? {
      unavailable: true,
      company: c.name,
      reason: 'SEC EDGAR could not be read just now; nothing is stored for it yet.',
    }
  );
}
