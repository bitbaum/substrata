/**
 * Markets: the organisations in the chain, and what each one actually makes.
 *
 * Two files describe companies for different reasons. `substrata-participants`
 * grades roughly a hundred organisations by how hard they are to replace, ore
 * to buyer. `substrata-coverage` lists, per material, the firms that make it,
 * each row separately verified. A reader does not care about that split: they
 * want one page per organisation showing what it makes, how well that is
 * evidenced, and what has happened to it.
 *
 * This module is that join. Two honesty rules it keeps:
 *
 *   1. A directory row's SCARCITY GRADE is always a judgement, never a
 *      finding, however well the row is sourced — grading how hard a company
 *      is to replace is analysis, not a fact a citation can settle. Every row
 *      started at `source: null`; a 2026-09 pass sourced all of them (each
 *      row now cites the company's own page for its role in the chain), and
 *      the pages say exactly that: the company's existence and role are
 *      sourced, the grade next to it is still this project's judgement.
 *   2. A producer row's verification comes from the coverage file and the
 *      evidence file, exactly as it does on a bottleneck page — the same fact
 *      cannot read differently in two places.
 *
 * Created: 2026-09-15
 */

import type { ListSpec } from 'listkit';

import { COVERAGE, PRODUCER_ROLES } from '@/config/substrata-coverage';
import { evidenceFor, verificationFor, type Verification } from '@/config/substrata-evidence';
import { eventsNewestFirst, type CoverageEvent } from '@/config/substrata-events';
import {
  CHAIN_LAYERS,
  PARTICIPANTS,
  SCARCITY_LABEL,
  type ChainLayer,
  type ScarcityGrade,
} from '@/config/substrata-participants';
import type { IndustryId, TechnologyId } from '@/config/substrata-taxonomy';
import { BOTTLENECKS, slugOf, type Bottleneck } from '@/lib/bottlenecks';
import { slugify } from '@/lib/links';

export interface Produces {
  bottleneck: string;
  slug: string;
  /** Mine, refine, convert, recycle — the step of the chain. */
  step: string;
  verification: Verification;
  source: string | null;
  candidateCount: number;
}

export interface MarketParticipant {
  slug: string;
  name: string;
  layer: ChainLayer;
  /** What it does in the chain, from the directory. Null where the row comes only from coverage. */
  role: string | null;
  scarcity: ScarcityGrade | null;
  /** Why it is graded that way. Null where the row comes only from coverage. */
  why: string | null;
  jurisdictions: string[];
  produces: Produces[];
  events: CoverageEvent[];
  technologies: TechnologyId[];
  industries: IndustryId[];
  /** True when the organisation appears in the graded directory. */
  inDirectory: boolean;
  /** True when at least one of its producer rows is verified. */
  hasVerifiedRow: boolean;
  /**
   * The directory's own citation for this row — the company's own page or
   * filing naming its role in the chain. `null` on the handful of rows a
   * source has not yet been found for, and always null for a row that exists
   * only via the coverage join (see `existenceVerifiedBy` for that case). The
   * GRADE is never sourced this way, from here or from coverage: no single
   * page asserts how replaceable a company is, only that it exists and does
   * what the row says.
   */
  directorySource: string | null;
  /**
   * A source that this organisation exists and does this in the chain, derived
   * from its verified maker rows rather than copied here.
   *
   * Where the coverage file has verified that this company makes a covered
   * material, that same URL establishes the factual half of the directory row
   * too — so it is surfaced rather than researched twice, and it appears the
   * moment a maker row is promoted. Populated even when `directorySource`
   * already covers the row: two independent citations for the same existence
   * claim is strictly more than one.
   */
  existenceVerifiedBy: { url: string; bottleneck: string } | null;
}

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCER_ROLES.map((role) => [role.id, role.label]),
);

/** Where a producer sits in the chain when the directory does not say. */
const LAYER_FOR_ROLE: Record<string, ChainLayer> = {
  mine: 'extraction',
  refine: 'refining',
  convert: 'conversion',
  recycle: 'refining',
};

const BOTTLENECK_BY_NAME = new Map<string, Bottleneck>(BOTTLENECKS.map((b) => [b.name, b]));

/**
 * What a chain layer implies about technology/industry when a participant has
 * no coverage-joined material to derive it from — the case for every
 * actuation-layer company (Harmonic Drive Systems, Nabtesco, FANUC, Yaskawa,
 * Renishaw, KUKA, ABB Robotics): none of them makes one of the fifteen
 * covered MATERIALS, so `bottlenecks.flatMap(b => b.technologies)` below was
 * always empty for them, and a company with empty `topics` cannot be found by
 * any query, however exactly it names what the company does.
 *
 * Deliberately only the two layers whose name already names the technology.
 * The compute-per-joule layers (extraction through systems) are left alone:
 * COVERAGE already carries their technology tags via the material, and
 * guessing a layer-wide technology for e.g. "conversion" would be an invented
 * classification, not a derived one.
 */
const LAYER_TECHNOLOGY: Partial<Record<ChainLayer, TechnologyId[]>> = {
  actuation: ['robotics'],
  energy: ['energy'],
};
const LAYER_INDUSTRY: Partial<Record<ChainLayer, IndustryId[]>> = {
  actuation: ['machinery'],
};

function build(): MarketParticipant[] {
  const byName = new Map<string, MarketParticipant>();

  for (const person of PARTICIPANTS) {
    byName.set(person.name, {
      slug: slugOf(person.name),
      name: person.name,
      layer: person.layer,
      role: person.role,
      scarcity: person.scarcity,
      why: person.why,
      jurisdictions: [...person.jurisdictions],
      produces: [],
      events: [],
      technologies: [],
      industries: [],
      inDirectory: true,
      hasVerifiedRow: false,
      directorySource: person.source,
      existenceVerifiedBy: null,
    });
  }

  for (const entry of COVERAGE) {
    for (const producer of entry.producers) {
      let record = byName.get(producer.name);
      if (!record) {
        record = {
          slug: slugOf(producer.name),
          name: producer.name,
          layer: LAYER_FOR_ROLE[producer.role] ?? 'conversion',
          role: null,
          scarcity: null,
          why: null,
          jurisdictions: [],
          produces: [],
          events: [],
          technologies: [],
          industries: [],
          inDirectory: false,
          hasVerifiedRow: false,
          directorySource: null,
          existenceVerifiedBy: null,
        };
        byName.set(producer.name, record);
      }
      const verification = verificationFor(entry.material, producer.name, producer.source);
      record.produces.push({
        bottleneck: entry.material,
        slug: slugOf(entry.material),
        step: ROLE_LABEL[producer.role] ?? producer.role,
        verification,
        source: producer.source,
        candidateCount: evidenceFor(entry.material, producer.name)?.candidates.length ?? 0,
      });
      if (verification === 'sourced') record.hasVerifiedRow = true;
      for (const code of producer.jurisdictions) {
        if (!record.jurisdictions.includes(code)) record.jurisdictions.push(code);
      }
    }
  }

  const events = eventsNewestFirst();
  for (const record of byName.values()) {
    const verified = record.produces.find((p) => p.verification === 'sourced' && p.source);
    record.existenceVerifiedBy = verified
      ? { url: verified.source as string, bottleneck: verified.bottleneck }
      : null;
    record.events = events.filter((event) => event.participants.includes(record.name));
    const bottlenecks = record.produces
      .map((p) => BOTTLENECK_BY_NAME.get(p.bottleneck))
      .filter((b): b is Bottleneck => Boolean(b));
    record.technologies = [
      ...new Set([
        ...bottlenecks.flatMap((b) => b.technologies),
        ...(LAYER_TECHNOLOGY[record.layer] ?? []),
      ]),
    ];
    record.industries = [
      ...new Set([
        ...bottlenecks.flatMap((b) => b.industries),
        ...(LAYER_INDUSTRY[record.layer] ?? []),
      ]),
    ];
  }

  const LAYER_ORDER = new Map(CHAIN_LAYERS.map((layer, index) => [layer.id, index]));
  const SCARCITY_ORDER: Record<ScarcityGrade, number> = {
    chokepoint: 0,
    concentrated: 1,
    competitive: 2,
  };

  return [...byName.values()].sort(
    (a, b) =>
      (LAYER_ORDER.get(a.layer) ?? 99) - (LAYER_ORDER.get(b.layer) ?? 99) ||
      (a.scarcity ? SCARCITY_ORDER[a.scarcity] : 3) -
        (b.scarcity ? SCARCITY_ORDER[b.scarcity] : 3) ||
      b.produces.length - a.produces.length ||
      a.name.localeCompare(b.name),
  );
}

export const MARKET_PARTICIPANTS: readonly MarketParticipant[] = build();

const BY_SLUG = new Map(MARKET_PARTICIPANTS.map((p) => [p.slug, p]));

/**
 * Whether an organisation named anywhere on the site has a page under Markets.
 *
 * Matched on the slug, not the name. Policy records a proponent as
 * "thyssenkrupp Electrical Steel" and the directory carries "ThyssenKrupp
 * Electrical Steel"; an exact-name lookup calls that a miss and silently
 * renders the one lobbying record on the site as unlinkable plain text.
 */
export function hasMarketPage(nameOrSlug: string): boolean {
  return BY_SLUG.has(slugify(nameOrSlug));
}

export function participantBySlug(slug: string): MarketParticipant | undefined {
  return BY_SLUG.get(slug);
}

/** Everyone who makes a given bottleneck, in coverage order. */
export function makersOf(bottleneck: string): MarketParticipant[] {
  return MARKET_PARTICIPANTS.filter((p) => p.produces.some((x) => x.bottleneck === bottleneck));
}

export const MARKET_SPEC: ListSpec<MarketParticipant> = {
  facets: [
    {
      key: 'layer',
      kind: 'one',
      value: (p) => p.layer,
      options: CHAIN_LAYERS.map((l) => l.id),
    },
    {
      key: 'grade',
      kind: 'one',
      value: (p) => p.scarcity ?? '',
      options: ['chokepoint', 'concentrated', 'competitive'],
    },
    {
      key: 'industry',
      kind: 'many',
      value: (p) => p.industries,
      options: [
        'semiconductors',
        'power-grid',
        'mining-materials',
        'gases-chemicals',
        'data-centres',
        'machinery',
      ],
    },
    {
      key: 'where',
      kind: 'many',
      value: (p) => p.jurisdictions,
    },
  ],
  search: {
    text: (p) => [
      p.name,
      p.role ?? '',
      p.why ?? '',
      ...p.jurisdictions,
      ...p.produces.map((x) => x.bottleneck),
    ],
  },
  sorts: [
    { key: 'chain', by: [(p) => p.name] },
    { key: 'name', by: [(p) => p.name] },
    { key: 'makes', by: [(p) => -p.produces.length, (p) => p.name] },
  ],
  defaultSort: 'chain',
  defaultPageSize: 250,
};

export interface MarketTotals {
  organisations: number;
  graded: number;
  chokepoints: number;
  withProducerRows: number;
  /** Directory rows whose existence and role are backed by a source. */
  existenceVerified: number;
  jurisdictions: number;
}

export function marketTotals(): MarketTotals {
  return {
    organisations: MARKET_PARTICIPANTS.length,
    graded: MARKET_PARTICIPANTS.filter((p) => p.scarcity !== null).length,
    chokepoints: MARKET_PARTICIPANTS.filter((p) => p.scarcity === 'chokepoint').length,
    withProducerRows: MARKET_PARTICIPANTS.filter((p) => p.produces.length > 0).length,
    existenceVerified: MARKET_PARTICIPANTS.filter((p) => p.existenceVerifiedBy !== null).length,
    jurisdictions: new Set(MARKET_PARTICIPANTS.flatMap((p) => p.jurisdictions)).size,
  };
}

export { SCARCITY_LABEL };
