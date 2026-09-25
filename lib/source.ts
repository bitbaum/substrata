/**
 * What counts as a producer-sourcing candidate, in one place.
 *
 * The box timer's run (`lib/source-store.ts`) is the only caller, and
 * `research_source_candidates` the only queue: the search query, the
 * domain-ranking and the excerpt match live here.
 *
 * A page is a candidate only when a company name and a material term sit in
 * the SAME window of text — see `matchOnPage`. This module never decides that
 * a row is SOURCED; it only ever returns a candidate, exactly as
 * `research_source_candidates` expects.
 */
import { readPage, webSearch, type WebResult } from '@bitbaum/ai-kit/web';

import { MATERIALS } from '@/config/substrata';
import { COVERAGE, type Producer } from '@/config/substrata-coverage';

/** Results considered per row, and how many pages get read. See the header on why so many. */
export const RESULTS_PER_ROW = 10;
export const PAGES_PER_ROW = 8;
/** Enough excerpts for a person to judge; more is noise. */
export const MAX_CANDIDATES_PER_ROW = 3;
/** Excerpt window either side of the company-name match, in characters. */
const EXCERPT_RADIUS = 220;

export type SourceStatus = 'candidate' | 'nothing' | 'could_not_look';

export interface SourceCandidate {
  url: string;
  title: string;
  /** The passage that matched, trimmed around the company name. */
  excerpt: string;
  /** Which terms matched on the page: the company name and material keywords. */
  matched: string[];
}

export interface SourceRow {
  material: string;
  producer: string;
  query: string;
  status: SourceStatus;
  checkedAt: string;
  candidates: SourceCandidate[];
}

/** Every unsourced producer row in the coverage universe, as the engine sees it. */
export function unsourcedRows(): { material: string; producer: Producer }[] {
  return COVERAGE.flatMap((entry) =>
    entry.producers
      .filter((p) => p.source === null)
      .map((p) => ({ material: entry.material, producer: p })),
  );
}

function listingFor(material: string) {
  const listing = MATERIALS.find((m) => m.title === material);
  if (!listing) throw new Error(`"${material}" is not in the catalogue`);
  return listing;
}

/**
 * Text as it should be compared: lowercase, no diacritics, and every kind of
 * dash collapsed to a space. Pages write "Sibanye Stillwater",
 * "Sibanye-Stillwater" and "Sibanye‑Stillwater" (non-breaking hyphen) for the
 * same company, and an exact `indexOf` misses two of the three.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-–—‑_/]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Terms that count as "the material" on a page. */
export function materialTerms(material: string): string[] {
  const listing = listingFor(material);
  const terms = new Set<string>([listing.search, ...(listing.searchAlso ?? []), ...listing.tags]);
  return [...terms].map(normalise).filter((t) => t.length > 2);
}

/** Every name a company might be written under: the row's name plus its aliases. */
export function namesFor(producer: { name: string; aliases?: string[] }): string[] {
  return [producer.name, ...(producer.aliases ?? [])];
}

/** The query: the company, quoted, plus what the trade calls the material. */
export function queryFor(producerName: string, material: string): string {
  return `"${producerName}" ${listingFor(material).search}`;
}

/** The part of a company name that appears in prose ("PT Timah" → "Timah"). */
export function nameStem(producer: string): string {
  const stripped = producer
    .replace(
      /\b(PT|AG|SA|SE|NV|Inc\.?|Corp\.?|Corporation|Ltd\.?|Co\.?|GmbH|Group|Holdings)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length >= 4 ? stripped : producer;
}

/** Words in a hostname that say nothing about which company owns it. */
const GENERIC_NAME_WORDS = new Set([
  'the',
  'and',
  'group',
  'company',
  'corporation',
  'corp',
  'inc',
  'ltd',
  'limited',
  'holdings',
  'international',
  'industries',
  'materials',
  'metals',
  'resources',
  'technologies',
  'energy',
  'steel',
  'chemical',
  'chemicals',
  'precious',
  'rare',
]);

/**
 * Does this URL belong to the company itself?
 *
 * Worth asking because 100% of the candidates the first run accepted were on a
 * company-owned domain, which makes search-result order the wrong order to read
 * in. This puts `airliquide.com` ahead of a news article about Air Liquide
 * without needing to know the domain in advance.
 */
export function looksLikeOwnDomain(url: string, names: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  const flat = host.replace(/[^a-z0-9]/g, '');
  return names.some((name) =>
    normalise(name)
      .split(' ')
      .filter((token) => token.length > 2 && !GENERIC_NAME_WORDS.has(token))
      .some((token) => flat.includes(token)),
  );
}

/** Search results ordered so the company's own pages are read first. */
export function readOrder(results: WebResult[], names: string[]): WebResult[] {
  const own = results.filter((r) => looksLikeOwnDomain(r.url, names));
  return [...own, ...results.filter((r) => !own.includes(r))];
}

/**
 * A page is a candidate only where a company name and a material term sit in
 * the SAME window of text. A name in the header and the material in the footer
 * is a page about both things, not a page that connects them — and the excerpt
 * filed is the passage a person will actually read, so it has to be the one
 * that makes the connection.
 */
export function matchOnPage(
  text: string,
  names: string[],
  material: string,
): SourceCandidate | null {
  const haystack = normalise(text);
  const terms = materialTerms(material);

  for (const name of names) {
    const stem = nameStem(name);
    const needle = normalise(stem);
    let at = haystack.indexOf(needle);
    while (at >= 0) {
      const start = Math.max(0, at - EXCERPT_RADIUS);
      const end = Math.min(haystack.length, at + needle.length + EXCERPT_RADIUS);
      const window = haystack.slice(start, end);
      const matched = terms.filter((term) => window.includes(term));
      if (matched.length > 0) {
        // Slice the ORIGINAL text at the same offsets: normalise preserves
        // length, so the excerpt a person reads keeps its real punctuation.
        const excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();
        return { url: '', title: '', excerpt, matched: [stem, ...matched] };
      }
      at = haystack.indexOf(needle, at + needle.length);
    }
  }
  return null;
}

export interface Examined {
  row: SourceRow;
  /** True when the search itself came back empty — which may mean blindness. */
  searchWasEmpty: boolean;
}

/** Search, read, and match one producer row. The one function both the CLI and the timer call. */
export async function examineRow(
  producer: { name: string; aliases?: string[] },
  material: string,
): Promise<Examined> {
  const names = namesFor(producer);
  const query = queryFor(producer.name, material);
  const checkedAt = new Date().toISOString();
  const base = { material, producer: producer.name, query, checkedAt };

  const search = await webSearch(query, { limit: RESULTS_PER_ROW, timeoutMs: 15_000 });

  if (search.status === 'could_not_look') {
    return {
      row: { ...base, status: 'could_not_look', candidates: [] },
      searchWasEmpty: false,
    };
  }
  if (search.status === 'nothing') {
    // Recorded as nothing for now; the caller decides whether a RUN of these
    // means the backend went dark, in which case it should be rewritten.
    return { row: { ...base, status: 'nothing', candidates: [] }, searchWasEmpty: true };
  }

  const candidates: SourceCandidate[] = [];
  for (const result of readOrder(search.results, names).slice(0, PAGES_PER_ROW)) {
    const page = await readPage(result.url, { timeoutMs: 15_000, maxChars: 60_000 });
    if (!page.ok) continue;
    const match = matchOnPage(page.text, names, material);
    if (match) {
      candidates.push({ ...match, url: page.url, title: page.title || result.title });
      if (candidates.length >= MAX_CANDIDATES_PER_ROW) break;
    }
  }

  const status: SourceStatus = candidates.length > 0 ? 'candidate' : 'nothing';
  return { row: { ...base, status, candidates }, searchWasEmpty: false };
}
