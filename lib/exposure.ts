/**
 * The exposure screen's rows: for every bottleneck, who holds it and where
 * their shares trade.
 *
 * One row per (bottleneck, organisation). Everything on a row is either a
 * corpus fact with its evidence state (the holder, its role, the listing and
 * its source) or a count with a rule in lib/methods.ts (net pressure). There
 * is no invented number here — no share, no revenue exposure — because the
 * corpus does not have one yet, and a screen that guessed would be worse than
 * one that says so.
 */
import type { Horizon } from '@/config/substrata-assessment';
import type { StageId } from '@/config/substrata-stages';
import type { Verification } from '@/config/substrata-evidence';
import { BOTTLENECKS, type Bottleneck } from '@/lib/bottlenecks';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { listingFor, type Listing } from '@/lib/listings';

export const PRESSURE_WINDOW_DAYS = 90;

export interface ExposureRow {
  bottleneck: string;
  bottleneckSlug: string;
  stage: StageId;
  binding: number;
  horizon: Horizon;
  /** Accepted events in the window: tightening minus loosening. */
  netPressure: number;
  company: string;
  /** Null when the holder has no page of its own in the directory. */
  companySlug: string | null;
  role: string;
  /** A part supplier is not a second source of the thing itself. */
  supplier: boolean;
  /** Other makers recorded on the same bottleneck — 0 means a single recorded maker. */
  otherMakers: number;
  verification: Verification;
  evidence: string | null;
  listing: Listing | null;
}

export function netPressure(b: Bottleneck, now: Date = new Date()): number {
  const since = new Date(now.getTime() - PRESSURE_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return b.events
    .filter((e) => e.date >= since)
    .reduce((n, e) => n + (e.effect === 'tightens' ? 1 : e.effect === 'loosens' ? -1 : 0), 0);
}

const SLUG_BY_NAME = new Map(MARKET_PARTICIPANTS.map((p) => [p.name, p.slug]));

export function exposureRows(now: Date = new Date()): ExposureRow[] {
  return BOTTLENECKS.flatMap((b) => {
    const pressure = netPressure(b, now);
    const makers = b.producers.filter((p) => !p.supplier).length;
    return b.producers.map((p) => {
      const slug = SLUG_BY_NAME.get(p.name) ?? null;
      return {
        bottleneck: b.name,
        bottleneckSlug: b.slug,
        stage: b.stage,
        binding: b.binding,
        horizon: b.horizon,
        netPressure: pressure,
        company: p.name,
        companySlug: slug,
        role: p.role,
        supplier: p.supplier,
        otherMakers: p.supplier ? makers : Math.max(0, makers - 1),
        verification: p.verification,
        evidence: p.source,
        listing: slug ? (listingFor(slug) ?? null) : null,
      };
    });
  });
}

export function isListed(row: Pick<ExposureRow, 'listing'>): boolean {
  return row.listing?.status === 'listed' || row.listing?.status === 'parent';
}

/** The row as CSV-safe cells, for the download. Header order is the column order. */
export const CSV_HEADER = [
  'bottleneck',
  'stage',
  'binding_out_of_12',
  'horizon',
  `net_pressure_${PRESSURE_WINDOW_DAYS}d`,
  'company',
  'role',
  'part_supplier',
  'other_makers_recorded',
  'evidence_state',
  'evidence_url',
  'listing_status',
  'listed_via_parent',
  'primary_ticker',
  'primary_exchange',
  'primary_figi',
  'us_ticker',
  'us_exchange',
  'sec_cik',
  'listing_checked_on',
] as const;

export function csvCells(row: ExposureRow): (string | number)[] {
  const l = row.listing;
  const listed = l && (l.status === 'listed' || l.status === 'parent') ? l : null;
  return [
    row.bottleneck,
    row.stage,
    row.binding,
    row.horizon,
    row.netPressure,
    row.company,
    row.role,
    row.supplier ? 'yes' : 'no',
    row.otherMakers,
    row.verification,
    row.evidence ?? '',
    l?.status ?? 'not-looked-up',
    listed?.parent ?? '',
    listed?.primary?.ticker ?? '',
    listed?.primary?.exchange ?? '',
    listed?.primary?.figi ?? '',
    listed?.us?.ticker ?? '',
    listed?.us?.exchange ?? '',
    listed?.us?.cik ?? '',
    l?.checkedOn ?? '',
  ];
}

export function toCsv(rows: readonly ExposureRow[]): string {
  const cell = (v: string | number) => {
    const text = String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return (
    [CSV_HEADER.join(','), ...rows.map((r) => csvCells(r).map(cell).join(','))].join('\n') + '\n'
  );
}
