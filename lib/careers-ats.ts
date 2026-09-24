/**
 * Reading each applicant-tracking system's public job-board JSON into one
 * shape. Greenhouse, Lever and Ashby each document an unauthenticated
 * endpoint for exactly this — publishing a company's open roles elsewhere —
 * and their robots.txt allows it. Nothing here fetches; lib/careers-store.ts does.
 */
import { countriesIn, countryCode } from '@/lib/careers-geo';
import type { Ats, RawPosting } from '@/lib/careers';

const ENTITY: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** HTML (possibly entity-escaped, as Greenhouse sends it) to plain text. */
export function plain(html: string): string {
  const decode = (s: string) =>
    s
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
      .replace(/&([a-z]+);/gi, (m, name: string) => ENTITY[name.toLowerCase()] ?? m);
  return decode(decode(html).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const isoOrNull = (v: unknown): string | null => {
  const t = typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

const REMOTE = /\bremote\b/i;

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  first_published?: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
  departments?: { name: string }[];
  offices?: { name: string; location?: string | null }[];
}

export function fromGreenhouse(board: string, company: string, job: GreenhouseJob): RawPosting {
  const location = job.location?.name ?? '';
  const offices = (job.offices ?? []).map((o) => o.location ?? o.name);
  return {
    id: `greenhouse:${board}:${job.id}`,
    company,
    title: job.title.trim(),
    location,
    countries: countriesIn([location, ...offices].join(' / ')),
    remote: REMOTE.test(location),
    department: (job.departments ?? []).map((d) => d.name).join(', '),
    postedAt: isoOrNull(job.first_published),
    url: job.absolute_url,
    text: plain(job.content ?? ''),
  };
}

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  country?: string;
  workplaceType?: string;
  categories?: { location?: string; department?: string; team?: string; allLocations?: string[] };
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
}

export function fromLever(board: string, company: string, job: LeverJob): RawPosting {
  const c = job.categories ?? {};
  const location = (c.allLocations?.length ? c.allLocations : [c.location ?? '']).join(' / ');
  const country = countryCode(job.country);
  return {
    id: `lever:${board}:${job.id}`,
    company,
    title: job.text.trim(),
    location,
    countries: country ? [country] : countriesIn(location),
    remote: job.workplaceType === 'remote' || REMOTE.test(location),
    department: [c.department, c.team].filter(Boolean).join(', '),
    postedAt: isoOrNull(job.createdAt),
    url: job.hostedUrl,
    text: [
      job.descriptionPlain ?? '',
      ...(job.lists ?? []).map((l) => `${l.text} ${plain(l.content)}`),
      job.additionalPlain ?? '',
    ].join('\n'),
  };
}

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  isListed?: boolean;
  publishedAt?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean | null;
  workplaceType?: string | null;
  department?: string;
  team?: string;
  address?: { postalAddress?: { addressCountry?: string } };
  descriptionPlain?: string;
}

export function fromAshby(board: string, company: string, job: AshbyJob): RawPosting {
  const locations = [
    job.location ?? '',
    ...(job.secondaryLocations ?? []).map((l) => l.location ?? ''),
  ];
  const location = locations.filter(Boolean).join(' / ');
  const country = countryCode(job.address?.postalAddress?.addressCountry);
  const fromText = countriesIn(location);
  return {
    id: `ashby:${board}:${job.id}`,
    company,
    title: job.title.trim(),
    location,
    countries: country ? [country, ...fromText.filter((c) => c !== country)] : fromText,
    remote: job.isRemote === true || job.workplaceType === 'Remote' || REMOTE.test(location),
    department: [job.department, job.team].filter(Boolean).join(', '),
    postedAt: isoOrNull(job.publishedAt),
    url: job.jobUrl,
    text: job.descriptionPlain ?? '',
  };
}

/** Every posting on one board's response, whatever the ATS. Unlisted Ashby jobs are skipped. */
export function parseBoard(ats: Ats, board: string, company: string, json: unknown): RawPosting[] {
  const o = (json ?? {}) as { jobs?: unknown[] };
  if (ats === 'lever') {
    return Array.isArray(json) ? (json as LeverJob[]).map((j) => fromLever(board, company, j)) : [];
  }
  if (!Array.isArray(o.jobs)) return [];
  if (ats === 'greenhouse') {
    return (o.jobs as GreenhouseJob[]).map((j) => fromGreenhouse(board, company, j));
  }
  return (o.jobs as AshbyJob[])
    .filter((j) => j.isListed !== false)
    .map((j) => fromAshby(board, company, j));
}

/** The public API URL for a board: the documented, unauthenticated endpoint each ATS publishes. */
export function boardUrl(ats: Ats, board: string): string {
  const b = encodeURIComponent(board);
  if (ats === 'greenhouse')
    return `https://boards-api.greenhouse.io/v1/boards/${b}/jobs?content=true`;
  if (ats === 'lever') return `https://api.lever.co/v0/postings/${b}?mode=json`;
  return `https://api.ashbyhq.com/posting-api/job-board/${b}`;
}
