/**
 * What a reader follows. Stored in research_preferences.topics as JSON.
 * Old rows were a string[] of technology ids; those still parse.
 */
import { TECHNOLOGIES, type TechnologyId } from '@/config/substrata-taxonomy';
import { MARKET_PARTICIPANTS } from '@/lib/participants';

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
