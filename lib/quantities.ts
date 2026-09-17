/**
 * Everything the figures imply, computed rather than stored.
 *
 * Share, concentration and reserves-to-production are all functions of the rows
 * in `config/substrata-quantities.ts`. Storing them would create a second copy
 * of the same fact, free to drift from the first — which is the failure this
 * codebase has already had twice, with entity ids and with relation labels.
 *
 * Each read says what it is made of, because a derived number that cannot be
 * traced back to its inputs is indistinguishable from an assertion.
 */
import {
  ENDOWMENTS,
  WORLD_TOTALS,
  type Endowment,
  type Quantity,
  type Unit,
} from '@/config/substrata-quantities';

export interface PlaceShare {
  place: string;
  production: Quantity;
  /** Fraction of the published world total, 0–1. Undefined when no total exists. */
  share?: number;
}

export function endowmentsFor(material: string): Endowment[] {
  return ENDOWMENTS.filter((row) => row.material === material).sort(
    (a, b) => (b.production?.value ?? 0) - (a.production?.value ?? 0),
  );
}

export function worldTotalFor(material: string) {
  return WORLD_TOTALS.find((row) => row.material === material);
}

/** Producers of a material, largest first, with each one's share of the world total. */
export function sharesFor(material: string): PlaceShare[] {
  const total = worldTotalFor(material);
  return endowmentsFor(material)
    .filter((row): row is Endowment & { production: Quantity } => Boolean(row.production))
    .map((row) => ({
      place: row.place,
      production: row.production,
      share:
        total && total.total.unit === row.production.unit && total.total.value > 0
          ? row.production.value / total.total.value
          : undefined,
    }));
}

/**
 * Concentration, on the Herfindahl index the competition authorities use.
 *
 * The corpus already judges "how few suppliers qualify" on a 0–3 scale. This is
 * the arithmetic companion to that judgement: computed from published shares
 * rather than asserted, so the two can be compared and the judgement argued
 * with. 1.0 is a single supplier; 0.1 is a fragmented market.
 *
 * Returns undefined rather than a number when shares are unknown — an index
 * computed over partial data reads as precision that is not there.
 */
export function concentrationOf(material: string): { hhi: number; from: number } | undefined {
  const shares = sharesFor(material).filter((row) => row.share !== undefined);
  if (shares.length === 0) return undefined;
  const hhi = shares.reduce((sum, row) => sum + (row.share ?? 0) ** 2, 0);
  return { hhi, from: shares.length };
}

/**
 * How long the current rate can continue, in years.
 *
 * Reserves divided by annual production. A blunt measure — reserves are
 * re-estimated as prices and technology move, so this is "at today's rate with
 * today's reserves", not a countdown.
 */
export function reservesToProduction(
  material: string,
  place: string,
): { years: number; reserves: Quantity; production: Quantity } | undefined {
  const row = endowmentsFor(material).find((entry) => entry.place === place);
  if (!row?.reserves || !row.production || row.reserves.unit !== row.production.unit)
    return undefined;
  if (row.production.value <= 0) return undefined;
  return {
    years: row.reserves.value / row.production.value,
    reserves: row.reserves,
    production: row.production,
  };
}

/** Whether a material has any figures at all, so a module can decline to render. */
export function hasQuantities(material: string): boolean {
  return ENDOWMENTS.some((row) => row.material === material);
}

export function formatQuantity(quantity: Quantity, unitLabel: Record<Unit, string>): string {
  const value =
    quantity.value >= 10_000 ? quantity.value.toLocaleString('en') : String(quantity.value);
  return `${value} ${unitLabel[quantity.unit]}`;
}
