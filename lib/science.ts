/**
 * Science pipeline items: the shape every feed is parsed into, how an item is
 * judged relevant to a bottleneck, and which pipeline stage it is evidence
 * for. Pure, so the rules are tests rather than impressions of a page.
 *
 * The fetch and the table are `lib/science-store.ts`; the parsers per source
 * are `lib/science-sources.ts`.
 */
import type { PipelineStage, ScienceQuery } from '@/config/substrata-pipeline';

export const SCIENCE_SOURCES = ['openalex', 'arxiv', 'nsf', 'openaire', 'doe'] as const;
export type ScienceSource = (typeof SCIENCE_SOURCES)[number];

export const SOURCE_LABEL: Record<ScienceSource, string> = {
  openalex: 'OpenAlex',
  arxiv: 'arXiv',
  nsf: 'NSF awards',
  openaire: 'OpenAIRE (EU and national funders)',
  doe: 'US DOE, via USAspending',
};

export type ItemKind = 'paper' | 'preprint' | 'grant' | 'patent';

export const KIND_LABEL: Record<ItemKind, string> = {
  paper: 'Paper',
  preprint: 'Preprint',
  grant: 'Grant',
  patent: 'Patent',
};

export interface Institution {
  name: string;
  /** As the source types it: OpenAlex says "education", "company", "facility"… */
  type: string | null;
  country: string | null;
}

export interface ScienceItem {
  /** Source-scoped id: "openalex:W123", "arxiv:2609.01234", "nsf:2412345". */
  id: string;
  source: ScienceSource;
  kind: ItemKind;
  title: string;
  abstract: string;
  venue: string | null;
  year: number | null;
  /** ISO date, as the source reports it. */
  publishedOn: string | null;
  url: string;
  doi: string | null;
  pdfUrl: string | null;
  /** As reported by the source on the day it was fetched. Null where the source has none. */
  citations: number | null;
  institutions: Institution[];
  funder: string | null;
  /** The funding programme or scheme, where the source names one ("SBIR Phase II", "HORIZON-RIA"). */
  programme: string | null;
  amount: number | null;
  currency: string | null;
}

/** Lower case, punctuation to spaces: "Nd-Fe-B" and "Nd Fe B" read the same. */
export function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

function has(haystack: string, phrase: string): boolean {
  const needle = normalise(phrase);
  if (needle.trim().length === 0) return false;
  // A plural still names the thing: "coated conductors" is about coated conductor.
  const stem = needle.trimEnd();
  return [needle, `${stem}s `, `${stem}es `].some((form) => haystack.includes(form));
}

export interface Relevance {
  score: number;
  matched: string[];
}

/**
 * How strongly an item is about a bottleneck: 3 per query phrase in the title,
 * 1 per phrase in the abstract, 1 per context word in the title. Kept at 2 or
 * more — one phrase in the abstract alone is how an astrophysics preprint
 * about "extreme ultraviolet" emission lands under lithography.
 */
export function relevance(
  item: Pick<ScienceItem, 'title' | 'abstract'>,
  q: ScienceQuery,
): Relevance {
  const title = normalise(item.title);
  const abstract = normalise(item.abstract);
  let score = 0;
  const matched: string[] = [];
  for (const phrase of q.phrases) {
    const inTitle = has(title, phrase);
    const inAbstract = has(abstract, phrase);
    if (inTitle) score += 3;
    if (inAbstract) score += 1;
    if (inTitle || inAbstract) matched.push(phrase);
  }
  for (const word of q.context) {
    if (has(title, word)) score += 1;
  }
  // A word that marks another field using the same phrase ("hybrid bonding" in welding).
  if ((q.exclude ?? []).some((word) => has(title, word) || has(abstract, word)))
    return { score: 0, matched };
  return { score, matched };
}

export const MIN_RELEVANCE = 2;

/** One key per work, across sources: a preprint and its journal version share a title. */
export function titleKey(title: string): string {
  return normalise(title).trim().split(' ').slice(0, 14).join(' ');
}

const LAB = [
  'we demonstrate',
  'we fabricate',
  'we fabricated',
  'fabricated',
  'prototype',
  'proof of concept',
  'experimentally demonstrate',
  'we report a device',
  'test bench',
];
const PILOT = [
  'pilot line',
  'pilot plant',
  'pilot scale',
  'field trial',
  'high volume manufacturing',
  'hvm',
  'production line',
  'demonstration plant',
];

export interface StagePlacement {
  stage: PipelineStage;
  why: string;
}

/**
 * Which stage an item is evidence for. The rule, in order:
 *  - a grant: SBIR/STTR Phase II, an EU Innovation Action or a DOE
 *    demonstration → pilot; Phase I, an EU Research and Innovation Action or
 *    any other DOE award → applied; anything else (NSF, ERC, national
 *    research councils) → fundamental;
 *  - a paper or preprint: pilot words ("pilot line", "field trial", "HVM")
 *    AND an author at a company → pilot; laboratory words ("we fabricate",
 *    "prototype", "test bench") → applied; otherwise fundamental;
 *  - a patent → applied.
 * Never early commercial or at scale: a paper cannot show a product is on sale.
 */
export function placeItem(
  item: Pick<ScienceItem, 'kind' | 'source' | 'title' | 'abstract' | 'programme' | 'institutions'>,
): StagePlacement {
  const text = normalise(`${item.title} ${item.abstract} ${item.programme ?? ''}`);
  const any = (words: string[]) => words.find((w) => has(text, w));
  if (item.kind === 'patent') return { stage: 'applied', why: 'A patent claims an invention.' };
  if (item.kind === 'grant') {
    if (/\b(sbir|sttr)\b.*\bphase (ii|2)\b|\bphase (ii|2)\b/.test(text))
      return { stage: 'pilot', why: 'SBIR/STTR Phase II award.' };
    if (/\bhorizon (eic )?ia\b|\binnovation action\b|\bdemonstrat/.test(text))
      return { stage: 'pilot', why: 'Innovation or demonstration award.' };
    if (/\bphase (i|1)\b|\bria\b|\bresearch and innovation action\b/.test(text))
      return { stage: 'applied', why: 'Phase I or research-and-innovation award.' };
    if (item.source === 'doe') return { stage: 'applied', why: 'DOE mission-applied award.' };
    return { stage: 'fundamental', why: 'Research grant.' };
  }
  const pilot = any(PILOT);
  const company = item.institutions.some((i) => i.type === 'company');
  if (pilot && company)
    return { stage: 'pilot', why: `Says "${pilot.trim()}" and has an author at a company.` };
  const lab = any(LAB);
  if (lab) return { stage: 'applied', why: `Says "${lab.trim()}".` };
  return { stage: 'fundamental', why: 'No laboratory or pilot wording.' };
}

/** A first slice of an abstract that ends on a word. */
export function snippet(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, clean.lastIndexOf(' ', max)).replace(/[,;:.]$/, '')}…`;
}
