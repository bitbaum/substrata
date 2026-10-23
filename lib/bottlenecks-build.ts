/**
 * Building the bottleneck rows: the join of materials and non-material
 * chokepoints into one shape, each with its producers, their evidence, the
 * assessment and the classification. `lib/bottlenecks.ts` is the public entry.
 */

import { MATERIALS, areaFor, type CurveId, type NodeType } from '@/config/substrata';
import {
  CHOKEPOINTS,
  COVERAGE,
  HOLDER_ROLES,
  PRODUCER_ROLES,
  type Chokepoint,
} from '@/config/substrata-coverage';
import { PARTICIPANTS } from '@/config/substrata-participants';
import { verificationFor, type Verification } from '@/config/substrata-evidence';
import {
  assessmentFor,
  bindingScore,
  type BindingScore,
  type Horizon,
} from '@/config/substrata-assessment';
import { eventsFor, type CoverageEvent } from '@/config/substrata-events';
import { classificationFor, type IndustryId, type TechnologyId } from '@/config/substrata-taxonomy';
import type { StageId } from '@/config/substrata-stages';

export interface BottleneckProducer {
  name: string;
  jurisdictions: string[];
  role: string;
  /**
   * Whether this row is a maker of the thing itself or only a supplier into
   * it. Second sources are counted among makers: Zeiss supplying the optics
   * does not make it a second EUV scanner maker.
   */
  supplier: boolean;
  verification: Verification;
  source: string | null;
}

export interface Bottleneck {
  slug: string;
  name: string;
  kind: NodeType;
  curve: CurveId;
  stage: StageId;
  /** Coverage area, for materials. */
  area: string | null;
  jurisdictions: string[];
  /** What it is, for someone who has never heard of it. */
  plain: string;
  /** Fronts of progress this bears on. */
  technologies: TechnologyId[];
  /** Trades a reader would look under. */
  industries: IndustryId[];
  /** Why it gates the curve — the research claim, one paragraph. */
  why: string;
  /** The grade that actually ships, for materials. */
  spec: string | null;
  producers: BottleneckProducer[];
  /** Row-level state: the weakest link across its producers. */
  state: Verification;
  counts: { sourced: number; total: number };
  /** The analyst's assessment: four tests, 0–3 each, and when it binds. */
  score: BindingScore;
  binding: number;
  horizon: Horizon;
  rationale: string;
  judgedOn: string;
  /** Accepted events touching this node, newest first. */
  events: CoverageEvent[];
}

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  [...PRODUCER_ROLES, ...HOLDER_ROLES].map((role) => [role.id, role.label]),
);

const DIRECTORY_BY_NAME = new Map(PARTICIPANTS.map((row) => [row.name, row]));

/**
 * A chokepoint's holders, as producer rows.
 *
 * The evidence is the holder's directory row: its source cites the company's
 * own page for the role that names this chokepoint, so the join inherits that
 * citation rather than restating it. A holder with no directory row is a
 * build error, not a silent gap — see the test on holders.
 */
function holdersOf(point: Chokepoint): BottleneckProducer[] {
  return point.holders.map((holder) => {
    const row = DIRECTORY_BY_NAME.get(holder.name);
    if (!row)
      throw new Error(
        `Chokepoint "${point.name}" names holder "${holder.name}", which is not in the directory`,
      );
    return {
      name: row.name,
      jurisdictions: [...row.jurisdictions],
      role: ROLE_LABEL[holder.role] ?? holder.role,
      supplier: holder.role === 'part',
      verification: row.source ? 'sourced' : 'unverified',
      source: row.source,
    };
  });
}

export function slugOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stateOf(counts: Bottleneck['counts']): Verification {
  if (counts.total > 0 && counts.sourced === counts.total) return 'sourced';
  // Partly sourced. Pages the engine found and nobody read are a live queue,
  // not corpus, so they never change a row's state here (lib/source-store.ts).
  if (counts.sourced > 0) return 'candidate';
  return 'unverified';
}

/**
 * The assessment and the classification are both mandatory: a bottleneck
 * without either cannot be built, so a missing row is a failed build rather
 * than a blank cell on a live page.
 */
function assessed(name: string) {
  const assessment = assessmentFor(name);
  if (!assessment)
    throw new Error(`No assessment for bottleneck "${name}" in config/substrata-assessment.ts`);
  const classification = classificationFor(name);
  return {
    plain: classification.plain,
    technologies: [...classification.technologies],
    industries: [...classification.industries],
    stage: assessment.stage,
    score: assessment.score,
    binding: bindingScore(assessment.score),
    horizon: assessment.horizon,
    rationale: assessment.rationale,
    judgedOn: assessment.judgedOn,
    events: eventsFor(name),
  };
}

export function materialBottlenecks(): Bottleneck[] {
  return COVERAGE.map((entry) => {
    const listing = MATERIALS.find((m) => m.title === entry.material);
    const producers: BottleneckProducer[] = entry.producers.map((producer) => ({
      name: producer.name,
      jurisdictions: producer.jurisdictions,
      role: ROLE_LABEL[producer.role] ?? producer.role,
      supplier: false,
      verification: verificationFor(producer.source),
      source: producer.source,
    }));
    const counts = {
      sourced: producers.filter((p) => p.verification === 'sourced').length,
      total: producers.length,
    };
    return {
      slug: slugOf(entry.material),
      name: entry.material,
      kind: 'material',
      curve: listing ? areaFor(listing).curve : 'compute-per-joule',
      area: listing ? areaFor(listing).name : null,
      jurisdictions: [...new Set(producers.flatMap((p) => p.jurisdictions))],
      why: entry.thesis,
      spec: listing?.spec ?? null,
      producers,
      state: stateOf(counts),
      counts,
      ...assessed(entry.material),
    };
  });
}

export function chokepointBottlenecks(): Bottleneck[] {
  return CHOKEPOINTS.map((point) => {
    const producers = holdersOf(point);
    // With holders, the row is judged like a material: by its weakest maker
    // row. Without any, by the chokepoint's own claim, as before.
    const counts =
      producers.length > 0
        ? {
            sourced: producers.filter((p) => p.verification === 'sourced').length,
            total: producers.length,
          }
        : { sourced: point.source ? 1 : 0, total: 1 };
    return {
      slug: slugOf(point.name),
      name: point.name,
      kind: point.type,
      curve: point.curve,
      area: null,
      jurisdictions: point.jurisdictions,
      why: point.why,
      spec: null,
      producers,
      state: stateOf(counts),
      counts,
      ...assessed(point.name),
    };
  });
}
