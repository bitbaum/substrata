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
 *   1. Directory rows are UNSOURCED. Every row in the participants file has
 *      `source: null`, and until that changes the pages say so rather than
 *      presenting a grade as a finding. That gap was invisible before.
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
  /** True when the organisation appears in the graded directory, which is entirely unsourced. */
  inDirectory: boolean;
  /** True when at least one of its producer rows is verified. */
  hasVerifiedRow: boolean;
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
    record.events = events.filter((event) => event.participants.includes(record.name));
    const bottlenecks = record.produces
      .map((p) => BOTTLENECK_BY_NAME.get(p.bottleneck))
      .filter((b): b is Bottleneck => Boolean(b));
    record.technologies = [...new Set(bottlenecks.flatMap((b) => b.technologies))];
    record.industries = [...new Set(bottlenecks.flatMap((b) => b.industries))];
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
  jurisdictions: number;
}

export function marketTotals(): MarketTotals {
  return {
    organisations: MARKET_PARTICIPANTS.length,
    graded: MARKET_PARTICIPANTS.filter((p) => p.scarcity !== null).length,
    chokepoints: MARKET_PARTICIPANTS.filter((p) => p.scarcity === 'chokepoint').length,
    withProducerRows: MARKET_PARTICIPANTS.filter((p) => p.produces.length > 0).length,
    jurisdictions: new Set(MARKET_PARTICIPANTS.flatMap((p) => p.jurisdictions)).size,
  };
}

export { SCARCITY_LABEL };
