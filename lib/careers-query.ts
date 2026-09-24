/**
 * Reading open roles back out of research_jobs: the board's filters, the
 * counts behind "which bottlenecks are hiring", and the desk's new postings.
 *
 * Every count here is a count of rows filed by the published rules
 * (lib/careers.ts) — a count of postings on the boards Substrata reads, never
 * a claim about how many people an industry is hiring.
 */
import { database } from './db';
import { SENIORITIES, type Seniority } from './careers';
import { ROLE_FAMILY_IDS, type RoleFamilyId } from '@/config/careers-roles';

export interface JobRow {
  id: string;
  companySlug: string;
  company: string;
  title: string;
  location: string;
  countries: string[];
  remote: boolean;
  family: RoleFamilyId;
  seniority: Seniority;
  bottlenecks: string[];
  skills: string[];
  postedAt: string | null;
  firstSeen: string;
  url: string;
}

export interface JobFilter {
  bottleneck?: string;
  company?: string;
  country?: string;
  family?: RoleFamilyId;
  seniority?: Seniority;
  remote?: boolean;
  q?: string;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The board's URL parameters, parsed so a hand-typed value lands on "no filter". */
export function parseJobFilter(params: Params): JobFilter {
  const family = one(params.family);
  const seniority = one(params.level);
  const country = one(params.country);
  return {
    bottleneck: one(params.bottleneck)?.slice(0, 120) || undefined,
    company: one(params.company)?.slice(0, 120) || undefined,
    country: country && /^[A-Z]{2}$/.test(country) ? country : undefined,
    family: ROLE_FAMILY_IDS.includes(family as RoleFamilyId) ? (family as RoleFamilyId) : undefined,
    seniority: SENIORITIES.includes(seniority as Seniority) ? (seniority as Seniority) : undefined,
    remote: one(params.remote) === '1' || undefined,
    q: one(params.q)?.trim().slice(0, 80) || undefined,
  };
}

function where(f: JobFilter): { sql: string; args: unknown[] } {
  const clauses = ['closed_at IS NULL'];
  const args: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    args.push(value);
    clauses.push(sql.replace('?', `$${args.length}`));
  };
  if (f.bottleneck) add('? = ANY(bottlenecks)', f.bottleneck);
  if (f.company) add('company_slug = ?', f.company);
  if (f.country) add('? = ANY(countries)', f.country);
  if (f.family) add('family = ?', f.family);
  if (f.seniority) add('seniority = ?', f.seniority);
  if (f.remote) clauses.push('remote');
  if (f.q)
    add(
      "title ILIKE '%' || ? || '%'",
      f.q.replace(/[%_\\]/g, (c) => `\\${c}`),
    );
  return { sql: clauses.join(' AND '), args };
}

const COLUMNS = `id, company_slug, company, title, location, countries, remote, family, seniority,
  bottlenecks, skills, posted_at, first_seen, url`;

interface DbRow {
  id: string;
  company_slug: string;
  company: string;
  title: string;
  location: string;
  countries: string[];
  remote: boolean;
  family: string;
  seniority: string;
  bottlenecks: string[];
  skills: string[];
  posted_at: Date | null;
  first_seen: Date;
  url: string;
}

function toJob(r: DbRow): JobRow {
  return {
    id: r.id,
    companySlug: r.company_slug,
    company: r.company,
    title: r.title,
    location: r.location,
    countries: r.countries,
    remote: r.remote,
    family: r.family as RoleFamilyId,
    seniority: r.seniority as Seniority,
    bottlenecks: r.bottlenecks,
    skills: r.skills,
    postedAt: r.posted_at?.toISOString() ?? null,
    firstSeen: r.first_seen.toISOString(),
    url: r.url,
  };
}

export async function openJobs(
  f: JobFilter,
  limit = 50,
  offset = 0,
): Promise<{ jobs: JobRow[]; total: number }> {
  const { sql, args } = where(f);
  const db = database();
  const [rows, total] = await Promise.all([
    db.query<DbRow>(
      `SELECT ${COLUMNS} FROM research_jobs WHERE ${sql}
        ORDER BY coalesce(posted_at, first_seen) DESC, id
        LIMIT ${Math.min(limit, 200)} OFFSET ${Math.max(0, Math.floor(offset))}`,
      args,
    ),
    db.query<{ n: string }>(`SELECT count(*) AS n FROM research_jobs WHERE ${sql}`, args),
  ]);
  return { jobs: rows.rows.map(toJob), total: Number(total.rows[0]?.n ?? 0) };
}

export type Facet = 'bottleneck' | 'company' | 'country' | 'family' | 'seniority' | 'skill';

const FACET_SQL: Record<Facet, string> = {
  bottleneck: 'unnest(bottlenecks)',
  company: 'company_slug',
  country: 'unnest(countries)',
  family: 'family',
  seniority: 'seniority',
  skill: 'unnest(skills)',
};

/** Open postings per value of one facet, under the other filters, most first. */
export async function facetCounts(facet: Facet, f: JobFilter = {}): Promise<Map<string, number>> {
  const { sql, args } = where(f);
  const result = await database().query<{ key: string; n: string }>(
    `SELECT ${FACET_SQL[facet]} AS key, count(*) AS n FROM research_jobs WHERE ${sql}
      GROUP BY 1 ORDER BY 2 DESC, 1`,
    args,
  );
  return new Map(result.rows.map((r) => [r.key, Number(r.n)]));
}

/**
 * Postings first seen within `days` at the followed companies, in the followed
 * families. Either list may be empty (no narrowing on it), not both.
 */
export async function newJobsFor(
  companies: readonly string[],
  families: readonly string[],
  days: number,
  limit = 60,
): Promise<JobRow[]> {
  if (companies.length + families.length === 0) return [];
  const result = await database().query<DbRow>(
    `SELECT ${COLUMNS} FROM research_jobs
      WHERE closed_at IS NULL
        AND first_seen > now() - ($3::float8 * interval '1 day')
        AND (cardinality($1::text[]) = 0 OR company_slug = ANY($1::text[]))
        AND (cardinality($2::text[]) = 0 OR family = ANY($2::text[]))
      ORDER BY first_seen DESC LIMIT $4`,
    [companies, families, days, limit],
  );
  return result.rows.map(toJob);
}

/** When the board was last read: the page's freshness line. */
export async function lastJobRun(): Promise<{ at: string; boards: number } | null> {
  const result = await database().query<{ finished_at: Date; boards: number }>(
    `SELECT finished_at, boards FROM research_job_runs
      WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`,
  );
  const row = result.rows[0];
  return row ? { at: row.finished_at.toISOString(), boards: row.boards } : null;
}
