/**
 * What a reader follows. Stored in research_preferences.topics as JSON.
 * Old rows were a string[] of technology ids; those still parse.
 */
import { TECHNOLOGIES, type TechnologyId } from '@/config/substrata-taxonomy';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { BOTTLENECKS, type Bottleneck } from '@/lib/bottlenecks';

export type FollowKind = 'individual' | 'organization';

export type Follows = {
  technologies: TechnologyId[];
  companies: string[];
  kind: FollowKind;
};

const TECH = new Set(TECHNOLOGIES.map((t) => t.id));
const COMPANY = new Set(MARKET_PARTICIPANTS.map((p) => p.slug));

export function parseFollows(raw: unknown): Follows {
  if (Array.isArray(raw)) {
    return {
      technologies: raw.filter(
        (id): id is TechnologyId => typeof id === 'string' && TECH.has(id as TechnologyId),
      ),
      companies: [],
      kind: 'individual',
    };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const technologies = Array.isArray(o.technologies)
      ? o.technologies.filter(
          (id): id is TechnologyId => typeof id === 'string' && TECH.has(id as TechnologyId),
        )
      : [];
    const companies = Array.isArray(o.companies)
      ? o.companies.filter((id): id is string => typeof id === 'string' && COMPANY.has(id))
      : [];
    const kind: FollowKind = o.kind === 'organization' ? 'organization' : 'individual';
    return { technologies, companies, kind };
  }
  return { technologies: [], companies: [], kind: 'individual' };
}

export function emptyFollows(): Follows {
  return { technologies: [], companies: [], kind: 'individual' };
}

/**
 * The bottlenecks a reader's follows reach — their rails.
 *
 * Following nothing yet is not an empty desk: it is the whole map, until they
 * narrow it. The same rule the desk applies (app/account keeps its own copy
 * for now; it should import this one), so Ask and the desk agree about what a
 * reader's rails are.
 */
export function railsOf(follows: Follows): Bottleneck[] {
  const companies = MARKET_PARTICIPANTS.filter((p) => follows.companies.includes(p.slug));
  if (follows.technologies.length === 0 && companies.length === 0) return [...BOTTLENECKS];
  return BOTTLENECKS.filter(
    (b) =>
      b.technologies.some((t) => follows.technologies.includes(t)) ||
      companies.some((p) => b.producers.some((row) => row.name === p.name)),
  );
}
