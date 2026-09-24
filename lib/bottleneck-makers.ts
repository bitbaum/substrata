/**
 * Who can make a bottleneck, and where — the one rule X-ray and Scenarios
 * share.
 *
 * A maker is a producer row that makes the thing itself or runs its capacity.
 * A part supplier is NOT a maker: Zeiss supplying the optics does not make it
 * a second source of EUV scanners, and counting it as one would turn a sole
 * maker into two on every page that asks "is there a second source?".
 */
import type { Bottleneck, BottleneckProducer } from '@/lib/bottlenecks';

export function makersOf(b: Bottleneck): BottleneckProducer[] {
  return b.producers.filter((p) => !p.supplier);
}

export function partSuppliersOf(b: Bottleneck): BottleneckProducer[] {
  return b.producers.filter((p) => p.supplier);
}

export interface MakerGeography {
  /** Country → recorded maker rows operating there. */
  countries: Map<string, number>;
  makers: number;
  /** `makers` when counted from maker rows; `location` when the bottleneck has none and only its own location is recorded. */
  basis: 'makers' | 'location';
}

export function makerGeography(b: Bottleneck): MakerGeography {
  const makers = makersOf(b);
  if (makers.length === 0) {
    return {
      countries: new Map(b.jurisdictions.map((c) => [c, 1])),
      makers: 0,
      basis: 'location',
    };
  }
  const countries = new Map<string, number>();
  for (const m of makers)
    for (const c of new Set(m.jurisdictions)) countries.set(c, (countries.get(c) ?? 0) + 1);
  return { countries, makers: makers.length, basis: 'makers' };
}

/** Whether every recorded maker (or the only recorded location) is in this country. */
export function allMakersIn(g: MakerGeography, country: string): boolean {
  const n = g.countries.get(country) ?? 0;
  return g.basis === 'makers' ? n > 0 && n === g.makers : g.countries.size === 1 && n > 0;
}
