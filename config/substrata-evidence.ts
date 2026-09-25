/**
 * Evidence — how a producer row is verified, kept apart from what the engine
 * finds.
 *
 * `substrata-coverage.ts` holds the claim: a producer's `source` is null until
 * a person attaches a primary source, and only then does the row read
 * "sourced". That is the corpus, and it is git.
 *
 * What the producer-sourcing engine finds — pages that mention the company
 * alongside the material — is not in git. It lives in one place, the review
 * queue `research_source_candidates`, filled every six hours by the box timer
 * (`lib/source-store.ts`) and read live by the bottleneck pages
 * (`lib/source-live.ts`). A found page is a lead, never a finding: promotion
 * stays a deliberate edit to the coverage file by someone who read it.
 *
 * Until 2026-09-25 a hand-run script also wrote `research/evidence.json`, a
 * second queue that went stale while the box one ran. Its unreviewed rows were
 * copied into the database queue and the file removed (git keeps it).
 *
 * Created: 2026-09-14
 */

export interface EvidenceCandidate {
  url: string;
  title: string;
  /** The passage that matched, trimmed around the company name. */
  excerpt: string;
  /** Which terms matched on the page: the company name and material keywords. */
  matched: string[];
}

/** The identity of a producer row, for the engine, the queue and the site alike. */
export function evidenceKey(material: string, producer: string): string {
  return `${material} :: ${producer}`;
}

/**
 * The verification state of a row. `sourced` is a checked claim; `candidate`
 * means a page was found and nobody has read it yet (a live lead, or a
 * bottleneck only partly sourced); `unverified` is neither. Only the first is
 * a finding.
 */
export type Verification = 'sourced' | 'candidate' | 'unverified';

/** What the corpus alone can say about a producer row: sourced or not. */
export function verificationFor(source: string | null): Verification {
  return source ? 'sourced' : 'unverified';
}

/** Status-column text. These are also the keywords sitekit colours the dot by. */
export const VERIFICATION_LABEL: Record<Verification, string> = {
  sourced: 'Sourced',
  candidate: 'Candidate source',
  unverified: 'Unverified lead',
};
