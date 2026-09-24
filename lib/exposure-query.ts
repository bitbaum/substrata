/**
 * The exposure screen's URL, parsed, and the rows it selects. Shared by the
 * page and the CSV route so a download is exactly the table on screen.
 */
import { STAGES, type StageId } from '@/config/substrata-stages';
import { isListed, type ExposureRow } from '@/lib/exposure';

export type Params = Record<string, string | undefined>;

export const ROLES = ['all', 'makers', 'suppliers'] as const;
export type RoleFilter = (typeof ROLES)[number];

export const SORTS = ['binding', 'pressure', 'company', 'bottleneck'] as const;
export type Sort = (typeof SORTS)[number];

export interface ExposureQuery {
  stage: StageId | null;
  role: RoleFilter;
  listedOnly: boolean;
  soleOnly: boolean;
  /** Restrict to the signed-in reader's rails. */
  mine: boolean;
  q: string;
  sort: Sort;
}

export function parseExposureQuery(params: Params): ExposureQuery {
  return {
    stage: STAGES.some((s) => s.id === params.stage) ? (params.stage as StageId) : null,
    role: ROLES.includes(params.role as RoleFilter) ? (params.role as RoleFilter) : 'all',
    listedOnly: params.listed === '1',
    soleOnly: params.sole === '1',
    mine: params.mine === '1',
    q: (params.q ?? '').slice(0, 80),
    sort: SORTS.includes(params.sort as Sort) ? (params.sort as Sort) : 'binding',
  };
}

export function queryString(query: ExposureQuery): string {
  const params = new URLSearchParams();
  if (query.stage) params.set('stage', query.stage);
  if (query.role !== 'all') params.set('role', query.role);
  if (query.listedOnly) params.set('listed', '1');
  if (query.soleOnly) params.set('sole', '1');
  if (query.mine) params.set('mine', '1');
  if (query.q) params.set('q', query.q);
  if (query.sort !== 'binding') params.set('sort', query.sort);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function selectRows(
  rows: readonly ExposureRow[],
  query: ExposureQuery,
  rails: ReadonlySet<string> | null,
): ExposureRow[] {
  const q = query.q.toLowerCase();
  const tickers = (r: ExposureRow) =>
    r.listing && (r.listing.status === 'listed' || r.listing.status === 'parent')
      ? `${r.listing.primary?.ticker ?? ''} ${r.listing.us?.ticker ?? ''}`
      : '';
  const kept = rows.filter(
    (r) =>
      (!query.stage || r.stage === query.stage) &&
      (query.role === 'all' || (query.role === 'makers' ? !r.supplier : r.supplier)) &&
      (!query.listedOnly || isListed(r)) &&
      (!query.soleOnly || (!r.supplier && r.otherMakers === 0)) &&
      (!query.mine || !rails || rails.has(r.bottleneck)) &&
      (!q || `${r.company} ${r.bottleneck} ${tickers(r)}`.toLowerCase().includes(q)),
  );
  const by: Record<Sort, (a: ExposureRow, b: ExposureRow) => number> = {
    binding: (a, b) => b.binding - a.binding || b.netPressure - a.netPressure,
    pressure: (a, b) => b.netPressure - a.netPressure || b.binding - a.binding,
    company: (a, b) => a.company.localeCompare(b.company),
    bottleneck: (a, b) => a.bottleneck.localeCompare(b.bottleneck),
  };
  return [...kept].sort(
    (a, b) =>
      by[query.sort](a, b) ||
      a.bottleneck.localeCompare(b.bottleneck) ||
      Number(a.supplier) - Number(b.supplier) ||
      a.company.localeCompare(b.company),
  );
}
