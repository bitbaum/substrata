/**
 * Building the market directory: the graded participants joined to every
 * bottleneck's producer rows, with events and topics derived from that join.
 * `lib/participants.ts` is the public entry.
 */

import { PRODUCER_ROLES } from '@/config/substrata-coverage';
import type { Verification } from '@/config/substrata-evidence';
import { eventsNewestFirst, type CoverageEvent } from '@/config/substrata-events';
import {
  CHAIN_LAYERS,
  PARTICIPANTS,
  type ChainLayer,
  type ScarcityGrade,
} from '@/config/substrata-participants';
import type { IndustryId, TechnologyId } from '@/config/substrata-taxonomy';
import { BOTTLENECKS, slugOf, type Bottleneck } from '@/lib/bottlenecks';

export interface Produces {
  bottleneck: string;
  slug: string;
  /** Mine, refine, convert, recycle — or makes / supplies a part / runs the capacity. */
  step: string;
  /** Supplies a part of the chokepoint rather than making it; not a second source. */
  supplier: boolean;
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

/** Where a producer sits in the chain when the directory does not say, by step label. */
const LAYER_FOR_ROLE: Record<string, ChainLayer> = {
  [ROLE_LABEL.mine]: 'extraction',
  [ROLE_LABEL.refine]: 'refining',
  [ROLE_LABEL.convert]: 'conversion',
  [ROLE_LABEL.recycle]: 'refining',
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

export function buildMarketParticipants(): MarketParticipant[] {
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

  // One join for every kind of bottleneck. This used to walk COVERAGE, which
  // lists only the materials, so a company that holds a machine, process or
  // capacity chokepoint (ASML, TSMC, SK hynix, Hitachi Energy…) joined to
  // nothing and its page said "no covered material is mapped". BOTTLENECKS
  // already carries both kinds with their evidence, so it is the one source.
  for (const bottleneck of BOTTLENECKS) {
    for (const producer of bottleneck.producers) {
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
      record.produces.push({
        bottleneck: bottleneck.name,
        slug: bottleneck.slug,
        step: producer.role,
        supplier: producer.supplier,
        verification: producer.verification,
        source: producer.source,
        candidateCount: producer.candidates.length,
      });
      if (producer.verification === 'sourced') record.hasVerifiedRow = true;
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
