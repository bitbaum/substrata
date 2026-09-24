/**
 * What a reader follows for jobs: companies and role families whose new
 * postings reach their desk. Kept apart from research follows on purpose — a
 * reader tracking ASML's filings does not necessarily want its 400 openings,
 * and a job seeker following field-service roles follows no bottleneck at all.
 */
import { ROLE_FAMILY_IDS, type RoleFamilyId } from '@/config/careers-roles';

export interface JobFollows {
  companies: string[];
  families: RoleFamilyId[];
}

export function parseJobFollows(
  raw: unknown,
  companyExists: (slug: string) => boolean,
): JobFollows {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string'))] : [];
  return {
    companies: list(o.companies).filter(companyExists).slice(0, 200),
    families: list(o.families).filter((f): f is RoleFamilyId =>
      ROLE_FAMILY_IDS.includes(f as RoleFamilyId),
    ),
  };
}

/** Follow or unfollow one company or family, returning the new lists. */
export function toggleJobFollow(
  current: JobFollows,
  kind: 'company' | 'family',
  id: string,
  on: boolean,
): JobFollows {
  const key = kind === 'company' ? 'companies' : 'families';
  const list = current[key] as string[];
  const next = on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
  return { ...current, [key]: next };
}
