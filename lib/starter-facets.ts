/**
 * One generator per facet of the corpus — the questions a facet can ask,
 * every candidate in a stable order. The pick is made in lib/starters.ts;
 * this file only knows what each kind of thing is called, where it lives and
 * what is worth asking about it. Empty means the facet has no data today and
 * is skipped, never padded.
 */
import { CAPITAL_PROVIDERS } from '@/config/substrata-capital';
import { eventsNewestFirst } from '@/config/substrata-events';
import { INSTRUMENTS, INSTRUMENT_KIND_LABEL, JURISDICTION_LABEL } from '@/config/substrata-policy';
import { resourceLabel } from '@/config/substrata-resources';
import { SCIENCE } from '@/config/substrata-science';
import { BOTTLENECKS, bottleneckByName } from '@/lib/bottlenecks';
import { entitiesOfKind } from '@/lib/entities/registry';
import { liveBoards } from '@/lib/job-boards';
import { bottleneckHref, capitalHref, marketHref, policyHref, scienceHref } from '@/lib/links';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { resourcesWithData } from '@/lib/resources/usgs';

/** The facets a starter can come from, in the order the rotation walks them. */
export const FACETS = [
  'bottleneck',
  'company',
  'material',
  'country',
  'policy',
  'science',
  'talent',
  'capital',
  'events',
] as const;

export type Facet = (typeof FACETS)[number];

export interface Starter {
  facet: Facet;
  /** What the tile says: short, so four fit in a row. */
  label: string;
  /** What is asked when the tile is pressed. */
  question: string;
  /** The corpus object the question is about, as it is named there. */
  about: string;
  /** Where that object lives on the site. */
  href: string;
}

/** The longest a tile's label may be; a label past it is clipped at a word. */
export const LABEL_MAX = 42;

/** Clip at a word boundary, with an ellipsis, so a long name never breaks a tile. */
export function clip(text: string, max = LABEL_MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,:;.]+$/, '')}…`;
}

// ---------------------------------------------------------------------------
// One generator per facet. Each returns every candidate, in a stable order;
// the pick is made below. Empty means the facet has no data and is skipped.
// ---------------------------------------------------------------------------

const aboutBottleneck = (name: string, facet: Facet, label: string, question: string) => ({
  facet,
  label: clip(label),
  question,
  about: name,
  href: bottleneckHref(name),
});

function bottleneckCandidates(): Starter[] {
  return [...BOTTLENECKS]
    .filter((b) => b.horizon === 'now')
    .sort((a, b) => b.binding - a.binding || a.name.localeCompare(b.name))
    .map((b) =>
      aboutBottleneck(
        b.name,
        'bottleneck',
        `What would ease ${b.name}?`,
        `${b.name} is among the most binding bottlenecks right now. Why does it bind, who holds it, and what would relieve it?`,
      ),
    );
}

function companyCandidates(): Starter[] {
  return MARKET_PARTICIPANTS.filter((p) => p.produces.length > 0).map((p) => ({
    facet: 'company' as const,
    label: clip(`What does ${p.name} hold?`),
    question: `What does ${p.name} hold in the chain, how well is that evidenced, and who else makes the same thing?`,
    about: p.name,
    href: marketHref(p.slug),
  }));
}

function materialCandidates(): Starter[] {
  return resourcesWithData().map((id) => {
    const label = resourceLabel(id);
    return {
      facet: 'material' as const,
      label: clip(`Who produces ${label.toLowerCase()}?`),
      question: `Who produces ${label.toLowerCase()}, in what shares, and who restricts its export?`,
      about: label,
      href: `/resources/${id}`,
    };
  });
}

function countryCandidates(): Starter[] {
  return entitiesOfKind('country')
    .filter((c) => c.evidence.startsWith('computed'))
    .map((c) => ({
      facet: 'country' as const,
      label: clip(`What does ${c.name} hold in the chain?`),
      question: `What does ${c.name} hold in the chain — which materials, what share of world output, and which bottlenecks depend on it?`,
      about: c.name,
      href: c.href,
    }));
}

/**
 * An instrument's title is a filing name ("Announcement No. 23 of 2023 on
 * export controls for gallium- and germanium-related items"), too long for a
 * tile and meaningless clipped. The tile says whose rule, of what year, of
 * what kind; the question carries the full title.
 */
/** "China's", "United States'". */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function policyCandidates(): Starter[] {
  return INSTRUMENTS.map((i) => ({
    facet: 'policy' as const,
    label: clip(
      `What does ${possessive(JURISDICTION_LABEL[i.jurisdiction])} ${i.date.slice(0, 4)} ${INSTRUMENT_KIND_LABEL[i.kind].toLowerCase()} change?`,
    ),
    question: `What does "${i.title}" change, and for whom — which bottlenecks and which companies does it touch?`,
    about: i.title,
    href: policyHref(i.jurisdiction),
  }));
}

/** "A fully synthetic crucible" mid-sentence is "a fully synthetic crucible". */
function midSentence(name: string): string {
  return name.replace(/^(A|An|The) /, (article) => article.toLowerCase());
}

function scienceCandidates(): Starter[] {
  return SCIENCE.map((s) => ({
    facet: 'science' as const,
    label: clip(`How close is ${midSentence(s.name)} to production?`),
    question: `How close is ${midSentence(s.name)} to production, what would it relieve, and what is the next milestone?`,
    about: s.name,
    href: scienceHref(s.id),
  }));
}

/**
 * Bottlenecks whose makers publish roles on a board the site reads (Greenhouse,
 * Lever, Ashby — research/job-boards.json). Only those can be answered with
 * real postings, so only those are asked; with no such board the facet is
 * skipped rather than promising jobs nobody can list.
 */
function talentCandidates(): Starter[] {
  const hiring = new Set(liveBoards().map((b) => b.slug));
  const names = new Set(
    MARKET_PARTICIPANTS.filter((p) => hiring.has(p.slug)).flatMap((p) =>
      p.produces.map((x) => x.bottleneck),
    ),
  );
  return [...names]
    .filter((name) => bottleneckByName(name))
    .sort()
    .map((name) =>
      aboutBottleneck(
        name,
        'talent',
        `Who is hiring for ${name}?`,
        `Which companies are hiring for ${name} right now, and what roles are open?`,
      ),
    );
}

function capitalCandidates(): Starter[] {
  return CAPITAL_PROVIDERS.map((c) => ({
    facet: 'capital' as const,
    label: clip(`What could ${c.name} move?`),
    question: `What could ${c.name} move — which bottlenecks does its mandate cover, and has it funded any of them?`,
    about: c.name,
    href: capitalHref(c.id),
  }));
}

/** The bottlenecks the newest checked events moved, newest first. */
function eventCandidates(): Starter[] {
  const names = new Set(eventsNewestFirst().flatMap((e) => e.bottlenecks));
  return [...names]
    .filter((name) => bottleneckByName(name))
    .slice(0, 6)
    .map((name) =>
      aboutBottleneck(
        name,
        'events',
        `What changed in ${name}?`,
        `What changed in ${name} according to the latest checked event, and did it tighten or loosen the bottleneck?`,
      ),
    );
}

export const GENERATORS: Record<Facet, () => Starter[]> = {
  bottleneck: bottleneckCandidates,
  company: companyCandidates,
  material: materialCandidates,
  country: countryCandidates,
  policy: policyCandidates,
  science: scienceCandidates,
  talent: talentCandidates,
  capital: capitalCandidates,
  events: eventCandidates,
};
