/**
 * What is said, with a source, about a resource in a country — the raw
 * material for "what holds expansion back". Nothing here is written by us:
 *
 * - sentences from the USGS chapter's "Events, Trends, and Issues" that name
 *   the country (research/usgs-mcs.json, quoted verbatim);
 * - accepted corpus events filed against the country on a bottleneck the
 *   resource feeds (config/substrata-events.ts, each with its own source).
 *
 * When neither has anything, the panel says "not recorded".
 */
import { EVENTS } from '@/config/substrata-events';
import { RESOURCE_TO_BOTTLENECKS, type ResourceId } from '@/config/substrata-resources';
import { WORLD_PATHS } from '@/config/world-paths';
import { chapterFor, chapters } from './usgs';

/** Names USGS prose uses that the map and the tables do not. */
const ALIASES: Record<string, string[]> = {
  cd: ['Congo (Kinshasa)', 'Democratic Republic of the Congo'],
  mm: ['Burma', 'Myanmar'],
  us: ['United States', 'U.S.'],
  kr: ['Republic of Korea', 'South Korea'],
  kp: ['North Korea'],
  gb: ['United Kingdom'],
  ru: ['Russia'],
  cn: ['China'],
  tr: ['Turkey', 'Türkiye'],
  la: ['Laos'],
  nc: ['New Caledonia'],
};

export function namesFor(iso2: string): string[] {
  const id = iso2.toLowerCase();
  const names = new Set<string>(ALIASES[id] ?? []);
  const map = WORLD_PATHS.find((p) => p.iso2 === id)?.name;
  if (map && !map.includes('.')) names.add(map);
  for (const chapter of chapters()) {
    for (const row of chapter.rows) if (row.iso2 === id) names.add(row.name);
  }
  return [...names].filter((n) => n.length > 2);
}

function sentences(text: string): string[] {
  // Protect abbreviations that end in a full stop before splitting.
  const safe = text.replace(/U\.S\./g, 'U§S§').replace(/\b(Inc|Ltd|Co|Corp|No)\./g, '$1§');
  return safe
    .split(/(?<=[.;])\s+(?=[A-Z“"])/)
    .map((s) => s.replace(/§/g, '.').trim())
    .filter((s) => s.length > 20);
}

function mentions(sentence: string, names: string[]): boolean {
  // "Guinea" must not match "Papua New Guinea", nor "Sudan" "South Sudan".
  return names.some((n) =>
    new RegExp(
      `(^|[^A-Za-z])(?<!(New|Equatorial|South|North) )${n.replace(/[.()]/g, '\\$&')}([^A-Za-z-]|$)`,
    ).test(sentence),
  );
}

export interface Statement {
  text: string;
  source: string;
  sourceLabel: string;
  date?: string;
  primary?: boolean;
}

export function usgsStatements(iso2: string, resource: string): Statement[] {
  const chapter = chapterFor(resource);
  if (!chapter?.events) return [];
  const names = namesFor(iso2);
  return sentences(chapter.events)
    .filter((s) => mentions(s, names))
    .map((text) => ({
      text,
      source: chapter.url,
      sourceLabel: `${chapter.source}, ${chapter.edition}: ${chapter.commodity}, "Events, Trends, and Issues"`,
    }));
}

export function corpusEvents(iso2: string, resource: string): Statement[] {
  const id = iso2.toLowerCase();
  const names = RESOURCE_TO_BOTTLENECKS[resource as ResourceId] ?? [];
  return EVENTS.filter(
    (e) =>
      e.jurisdictions.some((j) => j.toLowerCase() === id) &&
      e.bottlenecks.some((b) => names.includes(b)),
  )
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({
      text: e.headline,
      source: e.source,
      sourceLabel: e.primary ? 'Primary source' : 'Secondary source',
      date: e.date,
      primary: e.primary,
    }));
}
