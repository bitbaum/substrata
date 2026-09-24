/**
 * How long relief would take — only from what the corpus records.
 *
 * Three inputs, each shown with its basis and never blended into a date:
 *
 *   1. The assessment's lead-time score (0–3, decision to new capacity), a
 *      dated judgement with a rationale.
 *   2. The stage's relief time ("Years, per qualification"), an
 *      order-of-magnitude estimate the stages file labels as illustrative.
 *   3. For a country scenario on a material with USGS figures: the share of
 *      recorded world output that sits in that country, and so how much of
 *      the recorded output is outside it. Computed from
 *      config/substrata-quantities.ts; absent when the figures are.
 *
 * There is no recovery date here, because the corpus has no measured
 * lead-time series to compute one from.
 */
import { bottleneckBySlug } from '@/lib/bottlenecks';
import { endowmentsFor, sharesFor } from '@/lib/quantities';
import { STAGES, RELIEF_TIME_ESTIMATE } from '@/config/substrata-stages';
import type { Quantity } from '@/config/substrata-quantities';

export interface OutputShare {
  place: string;
  /** 0–1 of the recorded world total. */
  share: number;
  production: Quantity;
  describes: string | null;
  source: string;
}

export interface Recovery {
  bottleneck: string;
  slug: string;
  leadTime: number;
  rationale: string;
  judgedOn: string;
  stageName: string;
  reliefTime: string;
  reliefBasis: typeof RELIEF_TIME_ESTIMATE;
  output: OutputShare | null;
}

export function recoveryFor(slug: string, country: string | null): Recovery | null {
  const b = bottleneckBySlug(slug);
  if (!b) return null;
  const stage = STAGES.find((s) => s.id === b.stage);
  let output: OutputShare | null = null;
  if (country) {
    const place = country.toLowerCase();
    const row = sharesFor(slug).find((r) => r.place === place);
    const endowment = endowmentsFor(slug).find((r) => r.place === place);
    if (row?.share !== undefined && endowment)
      output = {
        place,
        share: row.share,
        production: row.production,
        describes: endowment.describes ?? null,
        source: endowment.source,
      };
  }
  return {
    bottleneck: b.name,
    slug: b.slug,
    leadTime: b.score.leadTime,
    rationale: b.rationale,
    judgedOn: b.judgedOn,
    stageName: stage?.name ?? b.stage,
    reliefTime: stage?.reliefTime ?? '',
    reliefBasis: RELIEF_TIME_ESTIMATE,
    output,
  };
}
