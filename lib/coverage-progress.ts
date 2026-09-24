/**
 * Progress over the coverage corpus: how much of it carries a source.
 *
 * Views over `config/substrata-coverage.ts`, kept out of that file so the
 * config holds data only.
 */
import { MATERIALS } from '@/config/substrata';
import { CHOKEPOINTS, COVERAGE } from '@/config/substrata-coverage';

export interface CoverageProgress {
  /** Research leads in the universe. */
  total: number;
  /** Rows with a primary source attached — the only ones that count as covered. */
  sourced: number;
  /** Materials on the desk with no coverage entry at all. */
  uncoveredMaterials: string[];
}

/**
 * What Phase 1 completion actually means. Rows without a source are leads, so
 * a universe of 90 unsourced entries is 0% covered, not 100% mapped.
 */
export function coverageProgress(): CoverageProgress {
  const rows = COVERAGE.flatMap((entry) => entry.producers);
  const covered = new Set(COVERAGE.map((entry) => entry.material));
  return {
    total: rows.length,
    sourced: rows.filter((producer) => producer.source !== null).length,
    uncoveredMaterials: MATERIALS.map((material) => material.title).filter(
      (title) => !covered.has(title),
    ),
  };
}

/** @returns every material a company appears on — the overlaps are the point. */
export function materialsFor(companyName: string): string[] {
  return COVERAGE.filter((entry) =>
    entry.producers.some((producer) => producer.name === companyName),
  ).map((entry) => entry.material);
}

export interface ChokepointProgress {
  total: number;
  sourced: number;
  byCurve: Record<string, number>;
}

/** Same honesty as the producer map: a row counts only once it has a source. */
export function chokepointProgress(): ChokepointProgress {
  const byCurve: Record<string, number> = {};
  for (const point of CHOKEPOINTS) {
    byCurve[point.curve] = (byCurve[point.curve] ?? 0) + 1;
  }
  return {
    total: CHOKEPOINTS.length,
    sourced: CHOKEPOINTS.filter((point) => point.source !== null).length,
    byCurve,
  };
}
