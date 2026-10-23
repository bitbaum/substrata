/**
 * One generator per facet of the corpus — the questions a facet can ask,
 * every candidate in a stable order. The pick is made in lib/starters.ts;
 * this file only knows what each kind of thing is called, where it lives and
 * what is worth asking about it. Empty means the facet has no data today and
 * is skipped, never padded.
 *
 * A label is never clipped: a tile that reads "What does United States' 2024
 * export…" says nothing, which is the complaint this exists to answer. Each
 * facet has a short template; a name that still does not fit is passed over
 * for the next in that facet (lib/starters.ts), and the question sent
 * carries the full name.
 */
import { CAPITAL_PROVIDERS } from '@/config/substrata-capital';
import { eventsNewestFirst } from '@/config/substrata-events';
import {
  INSTRUMENTS,
  INSTRUMENT_KIND_LABEL,
  JURISDICTIONS,
  type InstrumentKind,
  type JurisdictionId,
} from '@/config/substrata-policy';
import {
  RESOURCE_TO_BOTTLENECKS,
  resourceLabel,
  type ResourceId,
} from '@/config/substrata-resources';
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
  /** What the tile says: short, so four fit in a row. Never clipped. */
  label: string;
  /** What is asked when the tile is pressed. */
  question: string;
  /** The corpus object the question is about, as it is named there. */
  about: string;
  /** Where that object lives on the site. */
  href: string;
}

/** The longest a tile's label may be. A candidate past it is passed over, never clipped. */
export const LABEL_MAX = 42;

/** Whether a candidate's label fits a tile. */
export function fits(s: Starter): boolean {
  return s.label.length <= LABEL_MAX;
}

// ---------------------------------------------------------------------------
// One generator per facet. Each returns every candidate, in a stable order.
// ---------------------------------------------------------------------------

const aboutBottleneck = (name: string, facet: Facet, label: string, question: string) => ({
  facet,
  label,
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
        `What eases ${b.name}?`,
        `${b.name} is among the most binding bottlenecks right now. Why does it bind, who holds it, and what would relieve it?`,
      ),
    );
}

function companyCandidates(): Starter[] {
  return MARKET_PARTICIPANTS.filter((p) => p.produces.length > 0).map((p) => ({
    facet: 'company' as const,
    label: `What does ${p.name} hold?`,
    question: `What does ${p.name} hold in the chain, how well is that evidenced, and who else makes the same thing?`,
    about: p.name,
    href: marketHref(p.slug),
  }));
}

/**
 * Materials with a USGS table that a tracked bottleneck depends on
 * (RESOURCE_TO_BOTTLENECKS) — lithium, helium, gallium, silicon — rather than
 * everything the table lists, so oil does not lead the front page. Only when
 * no such material has a table does the facet fall back to the whole list.
 */
function materialCandidates(): Starter[] {
  const all = resourcesWithData();
  const tracked = all.filter((id) => (RESOURCE_TO_BOTTLENECKS[id as ResourceId]?.length ?? 0) > 0);
  return (tracked.length > 0 ? tracked : all).map((id) => {
    const label = resourceLabel(id);
    return {
      facet: 'material' as const,
      label: `Who produces ${label.toLowerCase()}?`,
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
      label: `What does ${c.name} hold?`,
      question: `What does ${c.name} hold in the chain — which materials, what share of world output, and which bottlenecks depend on it?`,
      about: c.name,
      href: c.href,
    }));
}

/** "US", "EU", "China": the jurisdiction as it fits a tile. */
function shortJurisdiction(id: JurisdictionId): string {
  const j = JURISDICTIONS.find((x) => x.id === id);
  return j?.short ?? j?.name ?? id.toUpperCase();
}

/** The kind as a noun phrase on a tile; the label is the word in the policy table. */
const KIND_WORD: Partial<Record<InstrumentKind, string>> = {
  permit: 'permitting rule',
  procedure: 'process reform',
};

/**
 * An instrument's title is a filing name ("Announcement No. 23 of 2023 on
 * export controls for gallium- and germanium-related items"), too long for a
 * tile and meaningless shortened. The tile says whose rule, of what year, of
 * what kind — "China 2023 export control: what changes?" — and the question
 * carries the full title. Subject first, then the ask, because "What does the
 * China 2023 export control change?" is 47 characters and only the shortest
 * kind ("tariff") fit a tile; this way all twelve do.
 */
function policyCandidates(): Starter[] {
  return INSTRUMENTS.map((i) => ({
    facet: 'policy' as const,
    label: `${shortJurisdiction(i.jurisdiction)} ${i.date.slice(0, 4)} ${KIND_WORD[i.kind] ?? INSTRUMENT_KIND_LABEL[i.kind].toLowerCase()}: what changes?`,
    question: `What does "${i.title}" change, and for whom — which bottlenecks and which companies does it touch?`,
    about: i.title,
    href: policyHref(i.jurisdiction),
  }));
}

/**
 * A name mid-sentence: "A fully synthetic crucible" is "a fully synthetic
 * crucible", "Nanoimprint lithography" is "nanoimprint lithography"; a name
 * that opens on an acronym or a number ("REBCO…", "200 mm…") is left alone.
 */
function midSentence(name: string): string {
  return /^[A-Z](?:[a-z]|\s)/.test(name) ? name[0].toLowerCase() + name.slice(1) : name;
}

function scienceCandidates(): Starter[] {
  return SCIENCE.map((s) => ({
    facet: 'science' as const,
    label: `How close is ${midSentence(s.name)}?`,
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
    label: `What could ${c.short} move?`,
    question: `What could ${c.name} move — which bottlenecks does its mandate cover, and has it funded any of them?`,
    about: c.name,
    href: capitalHref(c.id),
  }));
}

/** The bottlenecks the newest checked events moved, newest first, a dozen at most. */
function eventCandidates(): Starter[] {
  const names = new Set(eventsNewestFirst().flatMap((e) => e.bottlenecks));
  return [...names]
    .filter((name) => bottleneckByName(name))
    .slice(0, 12)
    .map((name) =>
      aboutBottleneck(
        name,
        'events',
        `${name}: what changed?`,
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
