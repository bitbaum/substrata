/**
 * Annual revenue from SEC company facts, as a universe size row. The public
 * float frames (edgar-universe.ts) cover only companies that file a 10-K; a
 * foreign private issuer (Arm, ASML, a 20-F or 40-F filer) states no float, so
 * it could never clear the materiality test however large it is. Its own
 * tagged annual revenue can: a figure the company printed, in a filing, which
 * the `revenue` floor (config/universe-themes.ts) asks for.
 *
 * Dollars only. A filer that reports in euros or yen is left to a source that
 * states a dollar figure; nothing is converted here, so no exchange rate is
 * ever invented. The quote is the fact object exactly as the API served it.
 */
import {
  allMetrics,
  companyFactsUrl,
  type CompanyFacts,
} from '@/lib/market-data/fundamentals/xbrl';
import type { SubmittedBy } from '@/lib/entry/candidate';
import type { UniverseRow } from '@/lib/universe/types';
import { bodyText, sourceFetch, type FetchDeps } from './http';

const SUBMITTED: SubmittedBy = {
  agent: 'universe-adapter',
  model: 'deterministic-adapter',
  runId: 'universe',
};

export interface RevenueRead {
  cik: string;
  name: string;
  usd: number;
  /** The fiscal year's last day. */
  end: string;
  url: string;
  quote: string;
  fetchedAt: string;
}

/** The newest annual revenue in US dollars, or null (no tag, another currency, no quotable fact). */
export function revenueOf(text: string, fetchedAt: string): RevenueRead | null {
  const cf = JSON.parse(text) as CompanyFacts;
  const revenue = allMetrics(cf).find((m) => m.metric === 'revenue');
  if (!revenue || 'unavailable' in revenue || revenue.unit !== 'USD') return null;
  const latest = revenue.annual.at(-1);
  if (!latest) return null;
  const escaped = latest.accession.replace(/[-]/g, '\\-');
  const found = new RegExp(
    `\\{[^{}]*"end":"${latest.end}"[^{}]*"val":${latest.value}[^{}]*"accn":"${escaped}"[^{}]*\\}`,
  ).exec(text);
  if (!found) return null;
  return {
    cik: String(cf.cik),
    name: cf.entityName,
    usd: latest.value,
    end: latest.end,
    url: companyFactsUrl(cf.cik),
    quote: found[0],
    fetchedAt,
  };
}

export async function readRevenue(cik: string, deps: FetchDeps = {}): Promise<RevenueRead | null> {
  try {
    const got = await sourceFetch(companyFactsUrl(Number(cik)), 'application/json', deps);
    return revenueOf(bodyText(got), got.fetchedAt);
  } catch {
    return null;
  }
}

export function revenueRow(slug: string, r: RevenueRead, readOn: string): UniverseRow {
  return {
    company: slug,
    name: r.name,
    family: 'filing',
    evidence: 'candidate',
    asOf: r.end,
    source: { url: r.url, quote: r.quote.slice(0, 400), readOn },
    submittedBy: SUBMITTED,
    provenance: { adapter: 'edgar-revenue', fetchedAt: r.fetchedAt, url: r.url },
    establishes: { ids: { cik: r.cik }, size: { basis: 'revenue', usd: r.usd } },
  };
}
