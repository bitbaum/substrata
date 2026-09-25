/**
 * What a company page says, derived in one place.
 *
 * The page used to assemble itself from sections that each asked their own
 * question of the corpus, and most of them asked about "covered materials"
 * only — so a firm that holds a machine or capacity chokepoint read as empty.
 * This module answers the questions a reader has of an organisation, from the
 * same joins the bottleneck pages use:
 *
 *   - which chokepoints does it hold, how hard does each bind, and who else
 *     makes the same thing (the second-source question);
 *   - what has happened to it, and to what it makes;
 *   - what could relieve its chokepoints;
 *   - where it operates, and every source behind all of that.
 *
 * Kept free of React so the joins are tested rather than eyeballed. Nothing
 * here computes a number the corpus does not hold: the binding score is the
 * assessment's own sum, counts are counts of rows, and no market share is
 * derived because no row carries one.
 */

import { eventsNewestFirst, type CoverageEvent } from '@/config/substrata-events';
import { FACILITIES, type Facility } from '@/config/substrata-facilities';
import { PARTICIPANTS, type ScarcityGrade } from '@/config/substrata-participants';
import { SCIENCE, type ScienceEntry } from '@/config/substrata-science';
import { SUBSTITUTES, type Substitute } from '@/config/substrata-substitutes';
import type { Verification } from '@/config/substrata-evidence';
import { WORLD_PATHS } from '@/config/world-paths';
import { BOTTLENECKS, bottleneckByName, type Bottleneck } from './bottlenecks';
import { resolveIn } from './entities/registry';
import { MARKET_PARTICIPANTS, participantBySlug, type MarketParticipant } from './participants';

export interface Counterpart {
  name: string;
  slug: string;
  jurisdictions: string[];
  verification: Verification;
}

export interface HeldChokepoint {
  bottleneck: Bottleneck;
  /** "Makes it", "Refine", "Runs the capacity"… */
  step: string;
  /** Supplies a part of it rather than making it. */
  supplier: boolean;
  verification: Verification;
  source: string | null;
  /**
   * For a maker: the other makers the corpus records on the same row — the
   * second sources. For a part supplier: the makers it supplies into.
   */
  counterparts: Counterpart[];
  /** For a maker: who the corpus records supplying a critical part of it. */
  suppliers: Counterpart[];
  /** A maker with no other recorded maker. "Recorded" is the whole claim. */
  soleRecorded: boolean;
}

export interface RelatedEvent {
  event: CoverageEvent;
  /** The chokepoint it reaches this page through. */
  through: Bottleneck;
}

export interface Relief {
  entry: ScienceEntry;
  bottlenecks: Bottleneck[];
}

export interface SubstituteRow {
  row: Substitute;
  bottleneck: Bottleneck;
}

export interface Place {
  code: string;
  name: string;
  href: string | null;
}

export interface PageSource {
  url: string;
  /** What the URL supports on this page, in plain words. */
  supports: string;
}

export interface LayerPeer {
  name: string;
  slug: string;
  scarcity: ScarcityGrade | null;
  role: string | null;
}

export interface CompanyProfile {
  participant: MarketParticipant;
  /** Hardest-binding first. */
  held: HeldChokepoint[];
  /** The rows it is the only recorded maker of. */
  soleRecorded: HeldChokepoint[];
  /** Its hardest-binding row, or null when it holds none. */
  hardest: HeldChokepoint | null;
  events: CoverageEvent[];
  relatedEvents: RelatedEvent[];
  relief: Relief[];
  substitutes: SubstituteRow[];
  places: Place[];
  facilities: Facility[];
  layerPeers: LayerPeer[];
  sources: PageSource[];
  /** How many bottlenecks the corpus tracks, for "holds none of N". */
  trackedBottlenecks: number;
}

function counterpart(p: MarketParticipant | undefined, name: string, v: Verification) {
  return {
    name,
    slug: p?.slug ?? '',
    jurisdictions: p?.jurisdictions ?? [],
    verification: v,
  };
}

const BY_NAME = new Map(MARKET_PARTICIPANTS.map((p) => [p.name, p]));

function countryName(code: string): string {
  const iso = code.toLowerCase();
  return WORLD_PATHS.find((path) => path.iso2 === iso)?.name ?? code.toUpperCase();
}

export function companyProfile(slug: string): CompanyProfile | undefined {
  const participant = participantBySlug(slug);
  if (!participant) return undefined;

  const held: HeldChokepoint[] = participant.produces.flatMap((row) => {
    const bottleneck = bottleneckByName(row.bottleneck);
    if (!bottleneck) return [];
    const others = bottleneck.producers.filter((p) => p.name !== participant.name);
    // A maker's counterparts are the other makers; a part supplier's are the
    // makers it supplies into. Suppliers are never counted as second sources.
    const counterparts = others
      .filter((p) => !p.supplier)
      .map((p) => counterpart(BY_NAME.get(p.name), p.name, p.verification));
    const suppliers = row.supplier
      ? []
      : others
          .filter((p) => p.supplier)
          .map((p) => counterpart(BY_NAME.get(p.name), p.name, p.verification));
    return [
      {
        bottleneck,
        suppliers,
        step: row.step,
        supplier: row.supplier,
        verification: row.verification,
        source: row.source,
        counterparts,
        soleRecorded: !row.supplier && counterparts.length === 0,
      },
    ];
  });
  held.sort(
    (a, b) =>
      b.bottleneck.binding - a.bottleneck.binding ||
      Number(a.supplier) - Number(b.supplier) ||
      a.bottleneck.name.localeCompare(b.bottleneck.name),
  );

  const names = new Set(held.map((h) => h.bottleneck.name));
  const own = new Set(participant.events.map((e) => e.id));
  const relatedEvents: RelatedEvent[] = [];
  for (const event of eventsNewestFirst()) {
    if (own.has(event.id)) continue;
    const hit = event.bottlenecks.find((name) => names.has(name));
    const through = hit ? bottleneckByName(hit) : undefined;
    if (through) relatedEvents.push({ event, through });
  }

  const relief: Relief[] = SCIENCE.flatMap((entry) => {
    const touched = entry.relieves
      .map((r) => r.bottleneck)
      .filter((name) => names.has(name))
      .map((name) => bottleneckByName(name))
      .filter((b): b is Bottleneck => Boolean(b));
    return touched.length > 0 ? [{ entry, bottlenecks: touched }] : [];
  });

  const slugs = new Map(held.map((h) => [h.bottleneck.slug, h.bottleneck]));
  const substitutes: SubstituteRow[] = SUBSTITUTES.flatMap((row) => {
    const bottleneck = slugs.get(row.material);
    return bottleneck ? [{ row, bottleneck }] : [];
  });

  const places: Place[] = participant.jurisdictions.map((code) => ({
    code,
    name: countryName(code),
    href: resolveIn('country', code.toLowerCase())?.href ?? null,
  }));

  const facilities = FACILITIES.filter((f) => f.operator === participant.name);

  const layerPeers: LayerPeer[] = PARTICIPANTS.filter(
    (row) => row.layer === participant.layer && row.name !== participant.name,
  ).map((row) => ({
    name: row.name,
    slug: BY_NAME.get(row.name)?.slug ?? '',
    scarcity: row.scarcity,
    role: row.role,
  }));

  const sources: PageSource[] = [];
  const cite = (url: string | null | undefined, supports: string) => {
    if (!url) return;
    const seen = sources.find((s) => s.url === url);
    if (seen) {
      if (!seen.supports.includes(supports)) seen.supports += `; ${supports}`;
    } else sources.push({ url, supports });
  };
  cite(participant.directorySource, `its role in the chain: ${participant.role ?? ''}`.trim());
  for (const h of held) cite(h.source, `${h.bottleneck.name}: ${h.step.toLowerCase()}`);
  for (const e of participant.events) cite(e.source, `event, ${e.date}: ${e.headline}`);
  for (const f of facilities) cite(f.source, `that it operates ${f.name}`);

  return {
    participant,
    held,
    soleRecorded: held.filter((h) => h.soleRecorded),
    hardest: held[0] ?? null,
    events: participant.events,
    relatedEvents,
    relief,
    substitutes,
    places,
    facilities,
    layerPeers,
    sources,
    trackedBottlenecks: BOTTLENECKS.length,
  };
}

/** The assessment behind a binding score, as a sum a reader can check. */
export function bindingSum(b: Bottleneck): string {
  const s = b.score;
  return `concentration ${s.concentration} + substitution ${s.substitution} + lead time ${s.leadTime} + inelasticity ${s.inelasticity} = ${b.binding} of 12`;
}
