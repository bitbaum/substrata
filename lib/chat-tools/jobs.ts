/**
 * Open roles from the companies on the chains, read from the job board the
 * site already keeps (research_jobs, refreshed from the companies' own
 * Greenhouse/Lever/Ashby boards). Asked by an electrical engineer in Germany
 * where the jobs are, the assistant named plants from memory while the board
 * held live postings it could not see.
 */
import { ROLE_FAMILIES, type RoleFamilyId } from '@/config/careers-roles';
import type { JobFilter, JobRow } from '../careers-query';
import { countryCode, countryName } from '../careers-geo';
import { findBottleneck } from './resolve';
import { num, str, type ChatTool } from './tool';

const FAMILY_IDS = ROLE_FAMILIES.map((f) => f.id);

/**
 * The role family a person's own words point at ("electrical engineer",
 * "power engineering"). Measured: "electrical engineer" was read as the
 * electrical-STEEL bottleneck and found nothing, while eleven US
 * power-engineering roles were open.
 */
const FAMILY_WORDS: [RegExp, RoleFamilyId][] = [
  [
    /\b(power|grid|transformers?|high[- ]voltage|substation|electrical engineer)/i,
    'power-engineering',
  ],
  [/\b(electricians?|electrical trades?|wiring)/i, 'electrical-trades'],
  [/\b(process engineer|fab|etch|lithography|deposition|yield)/i, 'process-engineering'],
  [/\b(field service|equipment engineer|service engineer)/i, 'equipment-service'],
  [/\btechnicians?\b/i, 'technicians'],
  [/\b(optics?|optical|photonics?|lasers?)\b/i, 'optics-photonics'],
  [/\b(materials?|metallurg|chemist|ceramics?)/i, 'materials'],
  [/\bnuclear\b/i, 'nuclear'],
  [/\b(cryogenic|industrial gas|helium|neon)/i, 'gases-cryogenics'],
  [/\b(mechatronic|robot|automation|controls engineer)/i, 'mechatronics'],
  [/\bdata ?cent(re|er)/i, 'data-centre'],
  [/\b(software|machine learning|ml engineer|ai engineer)/i, 'software-ai'],
];

export function familyIn(text: string): RoleFamilyId | undefined {
  return FAMILY_WORDS.find(([re]) => re.test(text))?.[1];
}

function boardHref(f: JobFilter): string {
  const p = new URLSearchParams();
  if (f.bottleneck) p.set('bottleneck', f.bottleneck);
  if (f.country) p.set('country', f.country);
  if (f.family) p.set('family', f.family);
  if (f.q) p.set('q', f.q);
  const qs = p.toString();
  return `/careers${qs ? `?${qs}` : ''}`;
}

function roleRow(j: JobRow) {
  return {
    title: j.title,
    company: j.company,
    location: j.location,
    remote: j.remote || undefined,
    posted: (j.postedAt ?? j.firstSeen).slice(0, 10),
    bottlenecks: j.bottlenecks.slice(0, 2),
    apply: j.url,
  };
}

export const JOB_TOOLS: ChatTool[] = [
  {
    name: 'open_roles',
    description: `Live job postings from the companies on the chains (their own job boards). Filter by bottleneck, country (name or 2-letter code), role family (${FAMILY_IDS.join(', ')}) and/or words in the title. Returns the newest matches, the total, and a link to the full board.`,
    parameters: {
      type: 'object',
      properties: {
        bottleneck: { type: 'string' },
        country: { type: 'string', description: 'e.g. Germany or DE' },
        family: { type: 'string', description: `One of: ${FAMILY_IDS.join(', ')}` },
        query: { type: 'string', description: 'Words in the job title, e.g. "high voltage"' },
        limit: { type: 'number', description: 'How many roles to list, default 8' },
      },
    },
    label: (a) =>
      `Checking open roles${str(a.country) ? ` in ${str(a.country)}` : ''}${str(a.bottleneck) ? ` for ${str(a.bottleneck)}` : ''}`,
    available: (env) => Boolean(env.jobs),
    async run(a, env) {
      if (!env.jobs) return { error: 'The job board is not reachable from here.' };
      const b = str(a.bottleneck) ? findBottleneck(str(a.bottleneck)) : undefined;
      const country = countryCode(str(a.country)) ?? undefined;
      const family = FAMILY_IDS.includes(str(a.family) as RoleFamilyId)
        ? (str(a.family) as RoleFamilyId)
        : undefined;
      const filter: JobFilter = {
        bottleneck: b?.name,
        country,
        family,
        q: str(a.query) || undefined,
      };
      const limit = num(a.limit, 8, 1, 15);
      // Nothing under every filter: loosen one at a time and say which went,
      // rather than tell a job seeker "0 open roles" while roles exist.
      let { jobs, total } = await env.jobs(filter, limit);
      const relaxed: string[] = [];
      for (const key of ['bottleneck', 'family', 'q'] as const) {
        if (total > 0 || !filter[key]) continue;
        delete filter[key];
        relaxed.push(key === 'q' ? 'title words' : key);
        ({ jobs, total } = await env.jobs(filter, limit));
      }
      return {
        ...(relaxed.length
          ? { relaxed: `Nothing matched every filter, so these drop: ${relaxed.join(', ')}.` }
          : {}),
        filter: {
          bottleneck: b?.name ?? null,
          country: country ? countryName(country) : null,
          family: family ?? null,
          query: filter.q ?? null,
        },
        total_open: total,
        roles: jobs.map(roleRow),
        board: boardHref(filter),
        status:
          'Live postings read from each company\'s own job board; "apply" links go to the employer.',
        ...(total === 0
          ? { hint: 'Nothing matches all filters: try without the role family or the title words.' }
          : {}),
      };
    },
  },
];
