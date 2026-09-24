/**
 * Step 3 of a scenario: which companies are exposed, and how.
 *
 * Exposure here is a relation the corpus records, never a size: a company
 * holds a hit bottleneck, holds one downstream of it, or a filing says it
 * needs or sells into one. Whether an exposure hurts or helps (a remaining
 * maker may gain pricing power) is the reader's call and is not guessed.
 */
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { companiesOn, type Dependency } from '@/lib/dependencies';
import { listingForName, type Listing } from '@/lib/listings';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import type { DirectHit, DownstreamHit } from './propagate';

export type Exposure =
  | 'failed'
  | 'lost-maker'
  | 'partly-affected'
  | 'remaining-maker'
  | 'part-supplier'
  | 'downstream-holder'
  | 'needs'
  | 'sells-into';

export const EXPOSURE_LABEL: Record<Exposure, string> = {
  failed: 'The failed node',
  'lost-maker': 'Maker lost',
  'partly-affected': 'Maker, partly in the failed country',
  'remaining-maker': 'Remaining maker',
  'part-supplier': 'Part supplier to a hit bottleneck',
  'downstream-holder': 'Holds a downstream bottleneck',
  needs: 'Needs it (filing)',
  'sells-into': 'Sells into it (filing)',
};

export interface ExposedCompany {
  name: string;
  slug: string | null;
  listing: Listing | null;
  exposures: { kind: Exposure; bottleneck: string; evidence: Dependency | null }[];
}

const SLUG_BY_NAME = new Map(MARKET_PARTICIPANTS.map((p) => [p.name, p.slug]));

export function exposedCompanies(
  hits: readonly DirectHit[],
  downstream: readonly DownstreamHit[],
  failedCompany: string | null,
): ExposedCompany[] {
  const out = new Map<string, ExposedCompany>();
  const add = (name: string, kind: Exposure, bottleneck: string, evidence: Dependency | null = null) => {
    const row = out.get(name) ?? {
      name,
      slug: SLUG_BY_NAME.get(name) ?? null,
      listing: listingForName(name),
      exposures: [],
    };
    if (!row.exposures.some((e) => e.kind === kind && e.bottleneck === bottleneck))
      row.exposures.push({ kind, bottleneck, evidence });
    out.set(name, row);
  };

  for (const h of hits) {
    for (const n of h.lost) add(n, n === failedCompany ? 'failed' : 'lost-maker', h.bottleneck);
    for (const n of h.partial) add(n, 'partly-affected', h.bottleneck);
    for (const n of h.remaining) add(n, 'remaining-maker', h.bottleneck);
    for (const n of h.partsLost) add(n, n === failedCompany ? 'failed' : 'part-supplier', h.bottleneck);
    const b = BOTTLENECKS.find((x) => x.name === h.bottleneck);
    for (const p of b?.producers.filter((x) => x.supplier && !h.partsLost.includes(x.name)) ?? [])
      add(p.name, 'part-supplier', h.bottleneck);
  }
  for (const d of downstream) {
    const b = BOTTLENECKS.find((x) => x.name === d.bottleneck);
    for (const p of b?.producers ?? []) add(p.name, 'downstream-holder', d.bottleneck);
  }
  for (const name of [...hits.map((h) => h.bottleneck), ...downstream.map((d) => d.bottleneck)]) {
    for (const edge of companiesOn(name))
      add(edge.from, edge.kind === 'sells-into' ? 'sells-into' : 'needs', name, edge);
  }

  const rank = (c: ExposedCompany) =>
    Math.min(...c.exposures.map((e) => Object.keys(EXPOSURE_LABEL).indexOf(e.kind)));
  return [...out.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
