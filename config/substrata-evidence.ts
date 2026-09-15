/**
 * Evidence — what the research engine found, kept apart from what the firm
 * asserts.
 *
 * `substrata-coverage.ts` holds the claim: a producer's `source` is null until
 * an analyst attaches a primary source, and only then does the row read
 * "sourced". This module holds the engine's output — for each unverified row,
 * the pages it found that mention the company alongside the material, with
 * the excerpt that matched and the date it looked. That is a candidate, not
 * a finding: a search engine and a string match can put a company and a
 * material on the same page without the page confirming the role the row
 * claims. Promotion stays a deliberate edit to the coverage file, made by
 * someone who read the excerpt.
 *
 * The file the engine writes is `research/evidence.json`, committed, so every
 * run is a dated entry in git history that nobody can quietly revise.
 *
 * Created: 2026-09-14
 */

import evidenceFile from '../research/evidence.json';

export type EvidenceStatus =
  /** At least one page mentions the company with the material. */
  | 'candidate'
  /** The search ran and found nothing usable. */
  | 'nothing'
  /** No search backend could be reached — an absence of looking, not of evidence. */
  | 'could_not_look';

export interface EvidenceCandidate {
  url: string;
  title: string;
  /** The passage that matched, trimmed around the company name. */
  excerpt: string;
  /** Which terms matched on the page: the company name and material keywords. */
  matched: string[];
}

export interface EvidenceRow {
  material: string;
  producer: string;
  query: string;
  status: EvidenceStatus;
  checkedAt: string;
  candidates: EvidenceCandidate[];
}

export interface EvidenceFile {
  /** Schema version, so the engine can refuse a file it does not understand. */
  version: 1;
  /** ISO timestamp of the most recent run that touched this file. */
  generatedAt: string | null;
  rows: EvidenceRow[];
}

export const EVIDENCE: EvidenceFile = evidenceFile as EvidenceFile;

/** The identity of a producer row, for the engine, the site and the tests alike. */
export function evidenceKey(material: string, producer: string): string {
  return `${material} :: ${producer}`;
}

const BY_ROW = new Map(EVIDENCE.rows.map((row) => [evidenceKey(row.material, row.producer), row]));

/** The engine's most recent look at a producer row, if it has had one. */
export function evidenceFor(material: string, producer: string): EvidenceRow | undefined {
  return BY_ROW.get(evidenceKey(material, producer));
}

/**
 * The three-valued verification state of a row, for the site and the API
 * alike. `sourced` is a checked claim; `candidate` is the search engine's lead;
 * `unverified` is neither. Only the first is a finding.
 */
export type Verification = 'sourced' | 'candidate' | 'unverified';

export function verificationFor(
  material: string,
  producer: string,
  source: string | null,
): Verification {
  if (source) return 'sourced';
  if (evidenceFor(material, producer)?.status === 'candidate') return 'candidate';
  return 'unverified';
}

/** Status-column text. These are also the keywords sitekit colours the dot by. */
export const VERIFICATION_LABEL: Record<Verification, string> = {
  sourced: 'Sourced',
  candidate: 'Candidate source',
  unverified: 'Unverified lead',
};

export interface EvidenceProgress {
  /** Rows with at least one candidate page. */
  candidates: number;
  /** Rows the engine looked at and found nothing for. */
  nothing: number;
  /** Rows the engine tried and could not look at. */
  couldNotLook: number;
  /** Rows the engine has ever examined. */
  examined: number;
}

export function evidenceProgress(): EvidenceProgress {
  let candidates = 0;
  let nothing = 0;
  let couldNotLook = 0;
  for (const row of EVIDENCE.rows) {
    if (row.status === 'candidate') candidates += 1;
    else if (row.status === 'nothing') nothing += 1;
    else couldNotLook += 1;
  }
  return { candidates, nothing, couldNotLook, examined: EVIDENCE.rows.length };
}
