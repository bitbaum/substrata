/**
 * Labs: organisations that research or train people for a tracked bottleneck —
 * an institute, a university group, a national laboratory.
 *
 * A lab earns a row the way everything else does: one source page that names
 * it, with a sentence quoted from that page. The row says only what it works
 * on (the bottlenecks it would relieve), where it is, and where a reader can
 * apply. Who pays for it is never a field here: funding is a `finances`
 * relation into `lab:<id>` (config/candidates/relations.json), each with its
 * own quote, so the page prints stated funders and nothing else.
 *
 * No lab is seeded by hand. Rows arrive through `scripts/research/add.ts labs`
 * (config/candidates/labs.json) and read "Candidate source" until promoted.
 */
import { labFromCandidate, sidecarRows, type LabCandidate } from '../lib/entry/candidate';
import labCandidates from './candidates/labs.json';

export type LabType = 'institute' | 'university-group' | 'national-lab';

export const LAB_TYPES: readonly LabType[] = ['institute', 'university-group', 'national-lab'];

export const LAB_TYPE_LABEL: Record<LabType, string> = {
  institute: 'Research institute',
  'university-group': 'University group',
  'national-lab': 'National laboratory',
};

export interface Lab {
  /** Stable slug, used in the URL. */
  id: string;
  /** As the lab names itself on its own page. */
  name: string;
  type: LabType;
  /** ISO-3166 alpha-2, lowercase: the country it is in. */
  place: string;
  /** Where in the country, in words (a city, a campus), when the source says. */
  where?: string;
  /** What it works on: a bottleneck NAME and the line of work, as the source describes it. */
  worksOn: { bottleneck: string; what: string }[];
  /** Its own page. */
  url: string;
  /** Where someone applies to work or study there (vacancies, a doctoral programme), or null. */
  join: string | null;
  source: string;
  quote: string;
  readOn: string;
  /** Set only on a row folded in from config/candidates/ — a model's row nobody has promoted. */
  evidence?: 'candidate';
}

export const LABS: readonly Lab[] = [
  // Candidate rows (config/candidates/labs.json), each flagged `evidence: 'candidate'`.
  ...sidecarRows<LabCandidate>(labCandidates).map(labFromCandidate),
];

export function labById(id: string): Lab | undefined {
  return LABS.find((lab) => lab.id === id);
}

export function labsIn(iso2: string): Lab[] {
  return LABS.filter((lab) => lab.place === iso2.toLowerCase());
}
