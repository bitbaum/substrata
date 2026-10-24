/**
 * Units a facility row and a national figure can be printed in, and the only
 * conversions allowed between them: exact, definitional factors within one
 * family. Tonnes become kilotonnes; tonnes never become carats, barrels or
 * "tonnes of contained metal". Anything else is `incomparable`, with the reason.
 */

type Family = 'mass' | 'volume' | 'carats' | 'oil-rate' | 'energy';

/** Each unit as a multiple of its family's base: tonne, cubic metre, carat. */
const UNITS: Record<string, { family: Family; factor: number }> = {
  kilograms: { family: 'mass', factor: 0.001 },
  kg: { family: 'mass', factor: 0.001 },
  'metric tons': { family: 'mass', factor: 1 },
  t: { family: 'mass', factor: 1 },
  'thousand metric tons': { family: 'mass', factor: 1_000 },
  kt: { family: 'mass', factor: 1_000 },
  'million metric tons': { family: 'mass', factor: 1_000_000 },
  Mt: { family: 'mass', factor: 1_000_000 },
  // One short ton is 907.18474 kg by definition.
  Mst: { family: 'mass', factor: 907_184.74 },
  // One troy ounce is 31.1034768 g by definition.
  'troy ounces': { family: 'mass', factor: 0.0000311034768 },
  'thousand cubic meters': { family: 'volume', factor: 1_000 },
  'million cubic meters': { family: 'volume', factor: 1_000_000 },
  Mcm: { family: 'volume', factor: 1_000_000 },
  bcm: { family: 'volume', factor: 1_000_000_000 },
  carats: { family: 'carats', factor: 1 },
  'thousand carats': { family: 'carats', factor: 1_000 },
  Mct: { family: 'carats', factor: 1_000_000 },
  'kb/d': { family: 'oil-rate', factor: 1 },
  TWh: { family: 'energy', factor: 1 },
};

export type Converted = { value: number; factor: number } | { incomparable: string };

/** `value` in `from`, expressed in `to`, or why it cannot be. */
export function convert(value: number, from: string, to: string): Converted {
  const a = UNITS[from];
  const b = UNITS[to];
  if (!a) return { incomparable: `the unit "${from}" is not one this check can convert` };
  if (!b) return { incomparable: `the unit "${to}" is not one this check can convert` };
  if (a.family !== b.family)
    return { incomparable: `"${from}" (${a.family}) and "${to}" (${b.family}) measure different things` };
  const factor = a.factor / b.factor;
  return { value: value * factor, factor };
}
