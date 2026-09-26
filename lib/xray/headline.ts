/**
 * The X-ray's first answer, in one line each: the single-source risk that
 * carries the most of the pasted weight, and the country the most weight rests
 * on alone. Ranking only — every number here is already in the report below
 * (rail weight, country weight); this picks which one to say first.
 */
import type { PortfolioXray } from './portfolio';

export interface TopRisk {
  company: string;
  bottleneck: string;
  slug: string;
  /** Share of pasted weight resting on that bottleneck, 0–1. */
  weight: number;
  binding: number;
  holdings: string[];
}

export interface TopCountry {
  country: string;
  weight: number;
  rails: string[];
}

/** A sole recorded maker is a single source; "no recorded maker" is a gap in the record, not a source. */
export function topSingleSourceRisk(x: Pick<PortfolioXray, 'rails' | 'risks'>): TopRisk | null {
  const rails = new Map(x.rails.map((r) => [r.bottleneck, r]));
  const ranked = x.risks
    .filter((r) => r.kind === 'sole-maker' && r.company)
    .flatMap((r) => {
      const rail = rails.get(r.bottleneck);
      return rail
        ? [
            {
              company: r.company as string,
              bottleneck: r.bottleneck,
              slug: r.slug,
              weight: rail.weight,
              binding: rail.binding,
              holdings: r.holdings,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.weight - a.weight || b.binding - a.binding || a.bottleneck.localeCompare(b.bottleneck),
    );
  return ranked[0] ?? null;
}

export function topCountry(x: Pick<PortfolioXray, 'countries'>): TopCountry | null {
  const c = x.countries.find((row) => row.allWeight > 0);
  return c ? { country: c.country, weight: c.allWeight, rails: c.allRails } : null;
}
