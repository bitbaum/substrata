/**
 * Prose claims about a bottleneck, tied to the numbers that measure them.
 *
 * The corpus says things like "lead times run past two years". Each entry here
 * names the sentence (verbatim, in the file it lives in — a test holds the two
 * together), the series that carry the number, and whether the sentence was
 * `measured` (a number backs it as written) or `softened` (the old wording
 * went further than any source, so it was cut back and says so).
 */
import claimsFile from '../research/claims.json';

export interface Claim {
  bottleneck: string;
  /** Repository path of the file the sentence lives in. */
  file: string;
  /** The sentence, or the part of it that makes the claim, verbatim. */
  text: string;
  verdict: 'measured' | 'softened';
  /** Series ids that carry the number. */
  series: string[];
  /** How the number bears on the sentence, and what was changed. */
  how: string;
}

const CLAIMS = claimsFile.claims as Claim[];

export function allClaims(): Claim[] {
  return CLAIMS;
}

export function claimsFor(bottleneck: string): Claim[] {
  return CLAIMS.filter((c) => c.bottleneck === bottleneck);
}
