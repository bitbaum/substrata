/**
 * Job postings from the public boards of directory companies, as pure
 * functions: reading each board's JSON into one shape, and filing a posting
 * under role family, seniority and bottlenecks.
 *
 * The fetch and the table are lib/careers-store.ts, the board parsers lib/careers-ats.ts; the boards themselves,
 * each verified on the company's own careers page, are research/job-boards.json.
 * Everything a posting is filed under is derived here from its own text, by
 * rules a reader can read (config/careers-terms.ts, config/careers-roles.ts) —
 * so a wrong filing is a wrong rule, fixed once for every posting.
 */
import { BOTTLENECK_TERMS, SKILL_TERMS } from '@/config/careers-terms';
import { ROLE_FAMILIES, type RoleFamilyId } from '@/config/careers-roles';

export type Ats = 'greenhouse' | 'lever' | 'ashby';

export const SENIORITIES = ['entry', 'mid', 'senior', 'lead'] as const;
export type Seniority = (typeof SENIORITIES)[number];
export const SENIORITY_LABEL: Record<Seniority, string> = {
  entry: 'Entry, intern or apprentice',
  mid: 'Experienced',
  senior: 'Senior, staff or principal',
  lead: 'Manager, director or above',
};

/** A posting as every board is read into, before it is filed. */
export interface RawPosting {
  /** `<ats>:<board>:<the board's own id>` — stable across fetches. */
  id: string;
  company: string;
  title: string;
  location: string;
  countries: string[];
  remote: boolean;
  department: string;
  /** When the employer published it, ISO; null when the board does not say. */
  postedAt: string | null;
  url: string;
  /** Plain text of the description, used for filing and then discarded. */
  text: string;
}

export interface Posting extends Omit<RawPosting, 'text'> {
  family: RoleFamilyId;
  seniority: Seniority;
  bottlenecks: string[];
  skills: string[];
}

/** Whole words and phrases: "tin" never matches "testing", "sic" never "music". */
function matcher(terms: readonly string[]): RegExp | null {
  if (terms.length === 0) return null;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![a-z0-9])(?:${escaped.join('|')})(?![a-z0-9])`, 'gi');
}

/**
 * Most specific first: "Substation Technician" is a trade before it is a
 * technician, "Data Center Technician" is data-centre operations.
 */
const CLASSIFY_ORDER: readonly RoleFamilyId[] = [
  'electrical-trades',
  'nuclear',
  'gases-cryogenics',
  'data-centre',
  'equipment-service',
  'optics-photonics',
  'process-engineering',
  'materials',
  'software-ai',
  'power-engineering',
  'mechatronics',
  'technicians',
];
const FAMILY_RULES = CLASSIFY_ORDER.map((id) => ({
  id,
  re: matcher(ROLE_FAMILIES.find((f) => f.id === id)?.titleTerms ?? []),
}));
const BOTTLENECK_RULES = Object.entries(BOTTLENECK_TERMS).map(([slug, terms]) => ({
  slug,
  re: matcher(terms)!,
}));
const SKILL_RULES = SKILL_TERMS.map((s) => ({ label: s.label, re: matcher(s.terms)! }));

function hits(re: RegExp | null, text: string): number {
  if (!re) return 0;
  re.lastIndex = 0;
  return text.match(re)?.length ?? 0;
}

/** First family whose title terms the title names; anything else is "business". */
export function familyOf(title: string): RoleFamilyId {
  for (const rule of FAMILY_RULES) if (hits(rule.re, title) > 0) return rule.id;
  return 'business';
}

export function seniorityOf(title: string): Seniority {
  const t = ` ${title.toLowerCase()} `;
  if (
    /\b(intern|internship|apprentice|trainee|graduate|new grad|entry|junior|jr\.?|werkstudent|co-op)\b/.test(
      t,
    )
  )
    return 'entry';
  if (/\b(manager|director|head of|vice president|vp|chief|lead)\b/.test(t)) return 'lead';
  if (/\b(senior|sr\.?|staff|principal|distinguished|expert|iii|iv)\b/.test(t)) return 'senior';
  return 'mid';
}

/**
 * The bottlenecks a posting is about: named in its title, or at least twice
 * in its description. One mention is usually the company describing itself.
 * Pass an empty description to file by title alone.
 */
export function bottlenecksOf(title: string, text: string): string[] {
  return BOTTLENECK_RULES.filter(
    (rule) => hits(rule.re, title) > 0 || hits(rule.re, text) >= 2,
  ).map((rule) => rule.slug);
}

/**
 * Families whose descriptions are not read for bottlenecks. A recruiter's or
 * a web developer's posting at a chip or AI company repeats the company's own
 * story ("our foundry partners", "grid interconnection") without being a job
 * on it; for these only the title counts.
 */
const TITLE_ONLY: ReadonlySet<RoleFamilyId> = new Set(['business', 'software-ai']);

export function skillsOf(text: string): string[] {
  return SKILL_RULES.filter((rule) => hits(rule.re, text) > 0).map((rule) => rule.label);
}

export function classify(raw: RawPosting): Posting {
  const { text, ...rest } = raw;
  const body = `${raw.department}\n${text}`;
  const family = familyOf(raw.title);
  return {
    ...rest,
    family,
    seniority: seniorityOf(raw.title),
    bottlenecks: bottlenecksOf(raw.title, TITLE_ONLY.has(family) ? '' : body),
    skills: skillsOf(`${raw.title}\n${body}`),
  };
}
