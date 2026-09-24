/**
 * "What if X fails": the propagation, one explainable step at a time.
 *
 * Step 1 — direct hits. For each bottleneck the node touches: which recorded
 * makers are lost, which remain, and which critical parts go with it. A part
 * supplier is never a second source (lib/bottleneck-makers.ts), so losing
 * ASML leaves EUV scanners with no recorded maker even though Zeiss and
 * Trumpf remain. A maker that also operates outside the failed country is
 * "partly affected": the row says where it operates, not how much.
 *
 * Step 2 — downstream. Every bottleneck that needs a hit one, transitively,
 * through recorded `needs` rows only (config/substrata-dependencies.ts).
 *
 * Step 3 — who is exposed: lib/scenario/exposed.ts. Recovery:
 * lib/scenario/recovery.ts. Nothing here estimates time or size.
 */
import { BOTTLENECKS, type Bottleneck } from '@/lib/bottlenecks';
import { makersOf, partSuppliersOf } from '@/lib/bottleneck-makers';
import { downstreamOf, type Dependency } from '@/lib/dependencies';
import { participantBySlug } from '@/lib/participants';
import type { Scenario } from './target';

export type HitStatus = 'target' | 'no-maker-left' | 'makers-left' | 'part-lost';

export interface DirectHit {
  bottleneck: string;
  slug: string;
  status: HitStatus;
  /** Makers wholly inside the failed node. */
  lost: string[];
  /** Makers that operate in the failed country and elsewhere. */
  partial: string[];
  /** Recorded makers wholly outside it. Part suppliers are never here. */
  remaining: string[];
  /** Critical-part suppliers lost with it (wholly or partly). */
  partsLost: string[];
  /** True when the bottleneck has no maker rows and only its location is recorded. */
  locationOnly: boolean;
}

export interface DownstreamHit {
  bottleneck: string;
  slug: string;
  /** The direct hit it traces back to. */
  from: string;
  path: Dependency[];
}

type Where = 'all' | 'some' | 'none';

/** Sort one bottleneck's producer rows by where they stand against the failure. */
export function splitProducers(b: Bottleneck, where: (p: { name: string; jurisdictions: string[] }) => Where) {
  const lost: string[] = [];
  const partial: string[] = [];
  const remaining: string[] = [];
  for (const m of makersOf(b)) {
    const w = where(m);
    (w === 'all' ? lost : w === 'some' ? partial : remaining).push(m.name);
  }
  const partsLost = partSuppliersOf(b)
    .filter((p) => where(p) !== 'none')
    .map((p) => p.name);
  return { lost, partial, remaining, partsLost };
}

export function statusOf(split: ReturnType<typeof splitProducers>): HitStatus | null {
  const { lost, partial, remaining, partsLost } = split;
  if (lost.length + partial.length === 0) return partsLost.length > 0 ? 'part-lost' : null;
  return remaining.length + partial.length === 0 ? 'no-maker-left' : 'makers-left';
}

function locationHit(b: Bottleneck, code: string): DirectHit | null {
  if (!b.jurisdictions.includes(code)) return null;
  const only = b.jurisdictions.length === 1;
  return {
    bottleneck: b.name,
    slug: b.slug,
    status: only ? 'no-maker-left' : 'makers-left',
    lost: [],
    partial: [],
    remaining: [],
    partsLost: [],
    locationOnly: true,
  };
}

export function directHits(s: Scenario): DirectHit[] {
  const at = s.at;
  if (at.kind === 'bottleneck') {
    const b = BOTTLENECKS.find((x) => x.slug === at.slug);
    if (!b) return [];
    const split = splitProducers(b, () => 'all');
    return [{ bottleneck: b.name, slug: b.slug, status: 'target', ...split, locationOnly: makersOf(b).length === 0 }];
  }
  const company = at.kind === 'company' ? participantBySlug(at.slug)?.name : null;
  const out: DirectHit[] = [];
  for (const b of BOTTLENECKS) {
    if (s.only.length > 0 && !s.only.includes(b.slug)) continue;
    if (at.kind === 'country' && makersOf(b).length === 0) {
      const hit = locationHit(b, at.code);
      if (hit) out.push(hit);
      continue;
    }
    const split = splitProducers(b, (p) => {
      if (at.kind === 'company') return p.name === company ? 'all' : 'none';
      if (!p.jurisdictions.includes(at.code)) return 'none';
      return p.jurisdictions.every((c) => c === at.code) ? 'all' : 'some';
    });
    const status = statusOf(split);
    if (status) out.push({ bottleneck: b.name, slug: b.slug, status, ...split, locationOnly: false });
  }
  return out;
}

export function downstreamHits(hits: readonly DirectHit[]): DownstreamHit[] {
  const direct = new Set(hits.map((h) => h.bottleneck));
  const out = new Map<string, DownstreamHit>();
  for (const hit of hits) {
    for (const reach of downstreamOf([hit.bottleneck])) {
      if (direct.has(reach.bottleneck) || out.has(reach.bottleneck)) continue;
      const b = BOTTLENECKS.find((x) => x.name === reach.bottleneck);
      if (b) out.set(b.name, { bottleneck: b.name, slug: b.slug, from: hit.bottleneck, path: reach.path });
    }
  }
  return [...out.values()].sort((a, b) => a.path.length - b.path.length);
}
