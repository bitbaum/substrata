/**
 * The bottleneck — the one unit the portal shows.
 *
 * The research keeps materials and non-material chokepoints in two files
 * because they are verified differently: a material has producers, each
 * sourced or not; a machine, a process or a queue is one row. A reader does
 * not care about that split. They want every constraint on the path to
 * recursive self-improvement in one list, scannable, filterable by the stage
 * of the loop it sits on, scored, dated, and each one a click from its
 * evidence and its events. This module is that join, and the list spec that
 * drives the board.
 *
 * Created: 2026-09-14
 */

import type { ListSpec } from 'listkit';

import {
  MANDATE_CURVES,
  MATERIALS,
  areaFor,
  type CurveId,
  type NodeType,
} from '@/config/substrata';
import {
  CHOKEPOINTS,
  COVERAGE,
  NODE_TYPE_LABEL,
  PRODUCER_ROLES,
} from '@/config/substrata-coverage';
import {
  VERIFICATION_LABEL,
  evidenceFor,
  verificationFor,
  type EvidenceCandidate,
  type Verification,
} from '@/config/substrata-evidence';
import {
  assessmentFor,
  bindingScore,
  type BindingScore,
  type Horizon,
} from '@/config/substrata-assessment';
import { eventsFor, type CoverageEvent } from '@/config/substrata-events';
import { STAGES, type StageId } from '@/config/substrata-stages';

export interface BottleneckProducer {
  name: string;
  jurisdictions: string[];
  role: string;
  verification: Verification;
  source: string | null;
  candidates: EvidenceCandidate[];
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
  /** Why it gates the curve — the research claim, one paragraph. */
  why: string;
  /** The grade that actually ships, for materials. */
  spec: string | null;
  producers: BottleneckProducer[];
  /** Row-level state: the weakest link across its producers. */
  state: Verification;
  counts: { sourced: number; candidate: number; total: number };
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
  PRODUCER_ROLES.map((role) => [role.id, role.label]),
);

export function slugOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stateOf(counts: Bottleneck['counts']): Verification {
  if (counts.total > 0 && counts.sourced === counts.total) return 'sourced';
  if (counts.candidate > 0 || counts.sourced > 0) return 'candidate';
  return 'unverified';
}

/** The assessment is mandatory: a bottleneck without one cannot be built, and a test says which is missing. */
function assessed(name: string) {
  const assessment = assessmentFor(name);
  if (!assessment)
    throw new Error(`No assessment for bottleneck "${name}" in config/substrata-assessment.ts`);
  return {
    stage: assessment.stage,
    score: assessment.score,
    binding: bindingScore(assessment.score),
    horizon: assessment.horizon,
    rationale: assessment.rationale,
    judgedOn: assessment.judgedOn,
    events: eventsFor(name),
  };
}

function materialBottlenecks(): Bottleneck[] {
  return COVERAGE.map((entry) => {
    const listing = MATERIALS.find((m) => m.title === entry.material);
    const producers: BottleneckProducer[] = entry.producers.map((producer) => ({
      name: producer.name,
      jurisdictions: producer.jurisdictions,
      role: ROLE_LABEL[producer.role] ?? producer.role,
      verification: verificationFor(entry.material, producer.name, producer.source),
      source: producer.source,
      candidates: evidenceFor(entry.material, producer.name)?.candidates ?? [],
    }));
    const counts = {
      sourced: producers.filter((p) => p.verification === 'sourced').length,
      candidate: producers.filter((p) => p.verification === 'candidate').length,
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

function chokepointBottlenecks(): Bottleneck[] {
  return CHOKEPOINTS.map((point) => {
    const counts = { sourced: point.source ? 1 : 0, candidate: 0, total: 1 };
    return {
      slug: slugOf(point.name),
      name: point.name,
      kind: point.type,
      curve: point.curve,
      area: null,
      jurisdictions: point.jurisdictions,
      why: point.why,
      spec: null,
      producers: [],
      state: stateOf(counts),
      counts,
      ...assessed(point.name),
    };
  });
}

const STAGE_ORDER: Record<StageId, number> = Object.fromEntries(
  STAGES.map((stage, index) => [stage.id, index]),
) as Record<StageId, number>;

const HORIZON_ORDER: Record<Horizon, number> = { now: 0, 'two-years': 1, beyond: 2 };

/** Stage order, then hardest-binding first, then soonest, then name. */
export function compareBottlenecks(a: Bottleneck, b: Bottleneck): number {
  return (
    STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
    b.binding - a.binding ||
    HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon] ||
    a.name.localeCompare(b.name)
  );
}

export const BOTTLENECKS: readonly Bottleneck[] = [
  ...materialBottlenecks(),
  ...chokepointBottlenecks(),
].sort(compareBottlenecks);

const BY_SLUG = new Map(BOTTLENECKS.map((b) => [b.slug, b]));
const BY_NAME = new Map(BOTTLENECKS.map((b) => [b.name, b]));

export function bottleneckBySlug(slug: string): Bottleneck | undefined {
  return BY_SLUG.get(slug);
}

export function bottleneckByName(name: string): Bottleneck | undefined {
  return BY_NAME.get(name);
}

export const CURVE_LABEL: Record<CurveId, string> = Object.fromEntries(
  MANDATE_CURVES.map((curve) => [curve.id, curve.label]),
) as Record<CurveId, string>;

export const KIND_LABEL = NODE_TYPE_LABEL;
export const STATE_LABEL = VERIFICATION_LABEL;

/** What the board can be narrowed by. Empty selection is the whole board. */
export const BOARD_SPEC: ListSpec<Bottleneck> = {
  facets: [
    { key: 'stage', kind: 'one', value: (b) => b.stage, options: STAGES.map((s) => s.id) },
    {
      key: 'horizon',
      kind: 'one',
      value: (b) => b.horizon,
      options: ['now', 'two-years', 'beyond'],
    },
    {
      key: 'state',
      kind: 'one',
      value: (b) => b.state,
      options: ['sourced', 'candidate', 'unverified'],
    },
    {
      key: 'kind',
      kind: 'many',
      value: (b) => b.kind,
      options: Object.keys(NODE_TYPE_LABEL),
    },
  ],
  search: { text: (b) => [b.name, b.why, ...b.jurisdictions, ...b.producers.map((p) => p.name)] },
  sorts: [
    {
      key: 'stage',
      by: [
        (b) => STAGE_ORDER[b.stage],
        (b) => -b.binding,
        (b) => HORIZON_ORDER[b.horizon],
        (b) => b.name,
      ],
    },
    { key: 'binding', by: [(b) => -b.binding, (b) => HORIZON_ORDER[b.horizon], (b) => b.name] },
    { key: 'name', by: [(b) => b.name] },
  ],
  defaultSort: 'stage',
  defaultPageSize: 100,
};

export interface PortalTotals {
  bottlenecks: number;
  bindingNow: number;
  producers: number;
  sourced: number;
  candidates: number;
  jurisdictions: number;
}

export function portalTotals(): PortalTotals {
  const producers = BOTTLENECKS.flatMap((b) => b.producers);
  return {
    bottlenecks: BOTTLENECKS.length,
    bindingNow: BOTTLENECKS.filter((b) => b.horizon === 'now').length,
    producers: producers.length,
    sourced: producers.filter((p) => p.verification === 'sourced').length,
    candidates: producers.filter((p) => p.verification === 'candidate').length,
    jurisdictions: new Set(BOTTLENECKS.flatMap((b) => b.jurisdictions)).size,
  };
}
