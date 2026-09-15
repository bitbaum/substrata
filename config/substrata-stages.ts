/**
 * The loop, in nine stages.
 *
 * Recursive self-improvement is a loop: capability applied to its own inputs.
 * Its speed is set by the slowest input that cannot be substituted. These are
 * the inputs, ordered roughly upstream to downstream, each with how long
 * relief takes once somebody decides to provide it. Every bottleneck sits on
 * exactly one stage, and every event attaches to the stages of the
 * bottlenecks it touches — so a stage with no bottleneck yet can still carry
 * events, which is how coverage finds the next node.
 *
 * `relief` is the order of magnitude of relief time as log10 seconds, the
 * same scale the programme ladder uses: 5 ≈ a day, 7 ≈ months, 8 ≈ years.
 *
 * Created: 2026-09-15
 */

export type StageId =
  | 'research'
  | 'data'
  | 'compute'
  | 'energy'
  | 'materials'
  | 'actuation'
  | 'talent'
  | 'capital'
  | 'permission';

export interface Stage {
  id: StageId;
  name: string;
  /** What the loop consumes at this stage. */
  consumes: string;
  /** Typical time from decision to relief, as words. */
  reliefTime: string;
  /** The same, as log10 seconds, so a ladder can be drawn to scale. */
  relief: number;
  /** Where coverage stands, in one line. Honest: most stages are not covered yet. */
  coverage: string;
}

export const STAGES: readonly Stage[] = [
  {
    id: 'research',
    name: 'Research & algorithms',
    consumes: 'Ideas, architectures, training recipes.',
    reliefTime: 'Days to weeks',
    relief: 6,
    coverage: 'Not covered yet. Candidates: evaluation saturation, reproducibility.',
  },
  {
    id: 'data',
    name: 'Data & evaluation',
    consumes: 'What the loop learns from, and how it knows it improved.',
    reliefTime: 'Weeks to months',
    relief: 6.7,
    coverage:
      'Not covered yet. Candidates: benchmark saturation, the sim-to-real gap, licensed corpora.',
  },
  {
    id: 'compute',
    name: 'Compute',
    consumes: 'Accelerators, memory, packaging, foundry capacity.',
    reliefTime: 'Quarters to years',
    relief: 7.6,
    coverage: 'Covered: foundry, packaging, HBM yield, EUV scanners and optics, photoresist.',
  },
  {
    id: 'energy',
    name: 'Energy',
    consumes: 'Megawatts where the compute is, and the steel, tape and gas to move them.',
    reliefTime: 'Years',
    relief: 8,
    coverage:
      'Covered: transformers, interconnection, turbines, HV cable, GOES, REBCO, helium, coolant.',
  },
  {
    id: 'materials',
    name: 'Materials & tools',
    consumes: 'Qualified grades and the consumables the machines burn.',
    reliefTime: 'Years, per qualification',
    relief: 8.2,
    coverage: 'Covered: tin, neon, ruthenium, polysilicon, wafers, quartz, gallium, diamond, SiC.',
  },
  {
    id: 'actuation',
    name: 'Actuation',
    consumes: 'Magnets, drives, sensors: the body a model acts through.',
    reliefTime: 'Years, at the magnet',
    relief: 7.9,
    coverage: 'Covered: Nd-Pr, dysprosium, magnet sintering, reduction drives, encoders.',
  },
  {
    id: 'talent',
    name: 'Talent',
    consumes: 'People who have ramped a fab, a line or a grid before.',
    reliefTime: 'Years',
    relief: 8.1,
    coverage:
      'Partly covered: semiconductor process engineers. Candidates: grid engineers, cleanroom crews.',
  },
  {
    id: 'capital',
    name: 'Capital',
    consumes: 'Allocation to relieve a constraint before price forces it.',
    reliefTime: 'Quarters',
    relief: 7,
    coverage:
      'Covered: ten kinds of capital and what each will not fund, three providers sourced to ' +
      'their own mandate, and a per-bottleneck read on whether funding is the constraint at all. ' +
      'For most rows it is not.',
  },
  {
    id: 'permission',
    name: 'Permission',
    consumes:
      'Export licences, permits, standards, interconnection rules — and the regulatory climate for AI, robotics, additive manufacturing and autonomy.',
    reliefTime: 'Years to a decade',
    relief: 8.4,
    coverage:
      'Interconnection queues sit here. The rest is next: where slowing is winning, which instruments do it, and who asks for them.',
  },
];

const BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]));

export function stageById(id: StageId): Stage {
  const stage = BY_ID.get(id);
  if (!stage) throw new Error(`Unknown stage: ${id}`);
  return stage;
}

export const STAGE_LABEL: Record<StageId, string> = Object.fromEntries(
  STAGES.map((stage) => [stage.id, stage.name]),
) as Record<StageId, string>;
