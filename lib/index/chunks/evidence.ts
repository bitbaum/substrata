/**
 * The corpus's evidence labels, mapped onto the index's closed set — in ONE
 * function, `indexEvidence`.
 *
 * Each entity adapter writes its evidence in its own words — "partly sourced;
 * replaceability is a judgement", "named by a primary source" — because the
 * profile page shows that sentence. The producer rows speak the three-valued
 * ladder of `config/substrata-evidence.ts` (`Verification`). The index wants
 * seven words a model can be taught (`INDEX_EVIDENCE`). This is the one place
 * those vocabularies meet, and `test/index-chunks.test.ts` fails on a corpus
 * label this map has not seen, so a new adapter cannot land a label that
 * silently reads "unverified".
 */
import type { Verification } from '@/config/substrata-evidence';
import type { IndexEvidence } from '../chunk';

/**
 * The ladder in `config/substrata-evidence.ts`, exhaustively: the type makes a
 * fourth `Verification` value a build error here until it is mapped.
 */
export const VERIFICATION_EVIDENCE = {
  sourced: 'sourced',
  candidate: 'candidate',
  unverified: 'unverified',
} as const satisfies Record<Verification, IndexEvidence>;

/** Every free-text label the adapters in `lib/entities/sources` write today. */
export const LABEL_EVIDENCE: Readonly<Record<string, IndexEvidence>> = {
  // Policy, capital, facility: a document that can be opened, primary or not.
  'primary source': 'sourced',
  'secondary source': 'sourced',
  'named by a primary source': 'sourced',
  'named by a secondary source': 'sourced',
  // Companies: a directory row with a source for the role; replaceability is judged.
  'partly sourced; replaceability is a judgement': 'candidate',
  // Science and loops: the project's own readings.
  'source-backed readiness judgement': 'judgement',
  'unsourced judgement': 'judgement',
  "the project's own model, not a measurement": 'judgement',
  // Writing: explainers, notes, the talent the project asks for.
  explanation: 'judgement',
  editorial: 'judgement',
  'project research need': 'judgement',
  // Countries: shares computed from tables, or the directory's blurb.
  'computed from USGS and EIA tables': 'computed',
  'directory, not a finding': 'directory',
};

/**
 * The index evidence for a corpus label — a `Verification` from
 * `config/substrata-evidence.ts` or an adapter's sentence — or undefined when
 * the label is one neither map has met. Callers decide what an unknown label
 * means; the chunk producers treat it as `unverified`, and the test refuses it.
 */
export function indexEvidence(label: string): IndexEvidence | undefined {
  if (Object.hasOwn(VERIFICATION_EVIDENCE, label))
    return VERIFICATION_EVIDENCE[label as Verification];
  return LABEL_EVIDENCE[label];
}
