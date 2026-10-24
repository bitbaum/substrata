/**
 * A USGS "Structure of the mineral industry" capacity cell, read as a number
 * for arithmetic — never as a replacement for the text.
 *
 * The page keeps printing the cell exactly as USGS printed it. This module only
 * answers "is there one number here a sum may use, and in what form?", and it
 * answers conservatively: anything it cannot read with certainty is reported
 * with the reason, never guessed, never divided.
 *
 * The shapes the file actually holds (research/usgs-producers.json, read
 * 2026-10-24):
 *
 *   "24000", "3,700", "9.5"            one number in the row's unit
 *   "1,200.e", "16.e", "2,300e"        one number USGS marks as estimated
 *   "NA", ""                           no capacity printed
 *   "450 iron ore", "10 (metal)"       one number for a named form of the material
 *   "12,000e copper; 2,000e cobalt"    one number per named material
 *   "2200 2400", "5. 4. 4"             more than one figure, no way to tell which applies
 *   "9,999,999 ore, which yields …"    a sentence with two figures in it
 *
 * The unit is not here: it is the row's own `unit` column (lib/coverage/units.ts).
 */

export interface CapacityPart {
  value: number;
  estimated: boolean;
  /** The material the figure is for, as printed ("copper", "metal", "iron ore"); absent for a bare number. */
  form?: string;
}

export type ParsedCapacity =
  | { kind: 'number'; printed: string; value: number; estimated: boolean }
  | { kind: 'parts'; printed: string; parts: CapacityPart[] }
  | { kind: 'not-printed'; printed: string }
  | { kind: 'unreadable'; printed: string; reason: string };

// 1,234 / 1234 / 9.5, with an optional USGS estimate mark: "e", ".e" or "e" after a comma group.
const NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\.?e)?$/;
// A number, then the material it is for.
const PART = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\.?e)?\s+(.+)$/;

function numberOf(whole: string, decimals: string | undefined): number {
  return Number(`${whole.replace(/,/g, '')}${decimals ?? ''}`);
}

/** "(metal)" → "metal"; "SX–EW.2" → "sx–ew" (a trailing footnote number is the table's, not the form's). */
function formOf(text: string): string {
  return text
    .replace(/[.,]\d+$/, '')
    .replace(/^\(|\)$/g, '')
    .replace(/[.,;:]+$/, '')
    .trim()
    .toLowerCase();
}

function partOf(text: string): CapacityPart | string {
  const m = PART.exec(text.trim());
  if (!m) return `"${text.trim()}" does not start with a figure`;
  const form = formOf(m[4]);
  if (/\d/.test(form)) return `"${text.trim()}" holds more than one figure`;
  if (!form) return `"${text.trim()}" names no material`;
  return { value: numberOf(m[1], m[2]), estimated: Boolean(m[3]), form };
}

/** Read one printed capacity cell. Pure; the same text always gives the same reading. */
export function parseCapacity(printed: string): ParsedCapacity {
  const text = printed.replace(/\s+/g, ' ').trim();
  if (!text || /^(na|n\/a|--|—|unavailable|not available)$/i.test(text))
    return { kind: 'not-printed', printed };
  const bare = NUMBER.exec(text);
  if (bare)
    return {
      kind: 'number',
      printed,
      value: numberOf(bare[1], bare[2]),
      estimated: Boolean(bare[3]),
    };
  // Two bare figures side by side ("2200 2400", "5. 4. 4", "4. NA"): which one is the capacity is not printed.
  if (/^[\d,.]+e?\.?(\s+([\d,.]+e?\.?|na))+$/i.test(text))
    return { kind: 'unreadable', printed, reason: 'more than one figure is printed for the row' };
  // A range is two figures too; neither end is the capacity.
  if (/^[\d,.]+\s*[-–]\s*[\d,.]+$/.test(text))
    return { kind: 'unreadable', printed, reason: 'a range is printed, not one figure' };
  const pieces = text.split(/;\s*|,\s+(?=\d)/).filter(Boolean);
  const parts: CapacityPart[] = [];
  for (const piece of pieces) {
    const part = partOf(piece);
    if (typeof part === 'string') return { kind: 'unreadable', printed, reason: part };
    parts.push(part);
  }
  return { kind: 'parts', printed, parts };
}

/**
 * The figure a sum for `material` may use, or why there is none.
 *
 * A bare number is the row's capacity. A cell that names forms gives a figure
 * only for the part printed as the material itself ("12,000e copper" for
 * copper); "copper cathode", "(metal)", "ore" and "concentrate" are other
 * stages or other bases, and are reported rather than added.
 */
export function figureFor(
  parsed: ParsedCapacity,
  material: string,
): { value: number; estimated: boolean } | { reason: string } {
  switch (parsed.kind) {
    case 'number':
      return { value: parsed.value, estimated: parsed.estimated };
    case 'not-printed':
      return { reason: 'no capacity printed (NA)' };
    case 'unreadable':
      return { reason: `capacity not read: ${parsed.reason}` };
    case 'parts': {
      const word = material.toLowerCase();
      const hits = parsed.parts.filter((p) => p.form === word);
      if (hits.length === 1) return { value: hits[0].value, estimated: hits[0].estimated };
      const forms = parsed.parts.map((p) => p.form).join(', ');
      return { reason: `capacity printed for ${forms}, not for ${word} as such` };
    }
  }
}
