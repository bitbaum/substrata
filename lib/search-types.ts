/**
 * The shapes search hands to the browser, with no dependency on the corpus —
 * the search box is a client component and must not pull the index (or the
 * filesystem reads behind the notes) into the bundle.
 */

/** Display groups, in the order a tie is broken. Notes and Learn read as one shelf. */
export const SEARCH_TYPES = [
  'bottleneck',
  'company',
  'country',
  'policy',
  'science',
  'event',
  'note',
  'glossary',
  'capital',
  'facility',
  'loop',
  'talent',
] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

export const SEARCH_TYPE_LABEL: Record<SearchType, { one: string; many: string }> = {
  bottleneck: { one: 'Bottleneck', many: 'Bottlenecks' },
  company: { one: 'Company', many: 'Companies' },
  country: { one: 'Country', many: 'Countries' },
  policy: { one: 'Policy', many: 'Policy' },
  science: { one: 'Science', many: 'Science' },
  event: { one: 'Event', many: 'Events' },
  note: { one: 'Note', many: 'Notes & learn' },
  glossary: { one: 'Glossary', many: 'Glossary' },
  capital: { one: 'Capital', many: 'Capital' },
  facility: { one: 'Facility', many: 'Facilities' },
  loop: { one: 'Loop', many: 'Loops' },
  talent: { one: 'Talent', many: 'Talent' },
};

export function isSearchType(value: unknown): value is SearchType {
  return typeof value === 'string' && (SEARCH_TYPES as readonly string[]).includes(value);
}

/** A run of text, marked when it is what matched. */
export interface Segment {
  text: string;
  hit?: true;
}

export interface SearchHit {
  id: string;
  type: SearchType;
  title: Segment[];
  snippet: Segment[];
  href: string;
  meta: string;
  score: number;
}

export interface SearchGroup {
  type: SearchType;
  count: number;
  hits: SearchHit[];
}

export interface SearchResult {
  query: string;
  /** The query as searched, when a word was corrected ("photresist" → "photoresist"). */
  corrected: string | null;
  /** True when no document had every word and the result is the best partial matches. */
  partial: boolean;
  total: number;
  counts: Partial<Record<SearchType, number>>;
  /** Hits in rank order, narrowed to `type` when given, capped at `limit`. */
  hits: SearchHit[];
  /** Hits per type, groups ordered by their best hit. Ignores `type`. */
  groups: SearchGroup[];
}
