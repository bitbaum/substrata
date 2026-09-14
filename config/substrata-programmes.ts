/**
 * Research programmes — the questions Substrata has been commissioned to
 * answer, written down before the answers exist.
 *
 * The coverage universe (`substrata-coverage.ts`) says WHAT gates the three
 * curves. A programme says WHY a reader would want that answered in a
 * particular shape, which rows of the universe bear on it, and — the part that
 * makes it research rather than an essay — what observation would settle each
 * open question. A programme with no falsifiers is a reading list.
 *
 * Every material or chokepoint a programme cites must exist in the universe.
 * A test enforces the correspondence, so a programme cannot quietly widen the
 * mandate: if the answer needs a node that is not covered, the node enters
 * coverage through the two tests like any other, and only then can the
 * programme cite it.
 *
 * Created: 2026-09-14
 */

import type { CurveId } from './substrata';

export type ProgrammeStatus = 'active' | 'paused' | 'closed';
export type DeliverableStatus = 'done' | 'in-progress' | 'not-started';

/**
 * One layer of a self-improvement loop, ordered by how long one turn of the
 * loop takes. The period is the research claim: it is what decides where an
 * agent that improves its own hardware actually spends its time waiting.
 */
export interface LoopLayer {
  id: string;
  name: string;
  /** How long one design → build → measure turn takes, as an order of magnitude. */
  period: string;
  /** The same period as log10 seconds, so a ladder can be drawn to scale. 2 ≈ minutes, 5 ≈ a day, 7 ≈ months, 8 ≈ years. */
  magnitude: number;
  /** What a single turn of the loop consists of, concretely. */
  turn: string;
  /** Coverage rows — material titles or chokepoint names — that gate this layer. */
  gatedBy: string[];
  /** The research note: why the period is what it is. */
  note: string;
}

export interface OpenQuestion {
  id: string;
  question: string;
  whyItMatters: string;
  /** What would settle it. A question without one is a topic. */
  settledBy: string;
}

export interface Deliverable {
  id: string;
  what: string;
  status: DeliverableStatus;
  detail: string;
}

export interface ResearchProgramme {
  id: string;
  title: string;
  /** The question, in one sentence a reader can disagree with. */
  question: string;
  /** ISO date the programme was opened. Git carries the rest of the history. */
  commissioned: string;
  status: ProgrammeStatus;
  curves: CurveId[];
  framing: string[];
  layers: LoopLayer[];
  questions: OpenQuestion[];
  deliverables: Deliverable[];
}

export const RESEARCH_PROGRAMMES: readonly ResearchProgramme[] = [
  {
    id: 'substrate-of-recursion',
    title: 'The substrate of recursion',
    question:
      'Which bottleneck sets the pace of recursive self-improvement — and where in the chain does it bind?',
    commissioned: '2026-09-14',
    status: 'active',
    curves: ['compute-per-joule', 'joules-delivered', 'actuation'],
    framing: [
      'Recursive self-improvement is usually discussed as a software event: a model that ' +
        'improves the model. But every improvement has to pass through a loop with a turn ' +
        'in it — train, build, measure, design again — and the rate of that loop is set by ' +
        'whatever it waits on, not by the intelligence driving it. What it waits on is a ' +
        'bottleneck: compute, energy, a material, a queue, a person. This programme maps them.',
      'The layers below are ordered by the period of one turn, from minutes to years. ' +
        'That ordering is the finding this programme starts from: an agent that can ' +
        'rewrite its own code in minutes still waits weeks for a board, a quarter for a ' +
        'training run, and years for a qualified material. Where the periods jump is where ' +
        'the chain gates, and the bottlenecks that gate each layer are named against it.',
      'Whether the world this happens in is itself a computation changes nothing here. ' +
        'A simulated universe and a base universe present the same lead times, the same ' +
        'order books and the same fifteen materials to anyone building inside them. The ' +
        'substrate is the part of the question that can actually be researched.',
    ],
    layers: [
      {
        id: 'scaffold',
        name: 'Software scaffold',
        period: 'Minutes',
        magnitude: 2,
        turn: 'An agent rewrites its own prompts, tools or orchestration and is scored on its next runs.',
        gatedBy: [
          'Leading-edge foundry capacity',
          'Advanced packaging capacity',
          'High-bandwidth memory stacking yield',
        ],
        note:
          'The only layer whose loop already closes without a human. Its constraint is ' +
          'not the code but the compute it runs on, which is why the packaging and memory ' +
          'rows appear here and not only under silicon.',
      },
      {
        id: 'firmware',
        name: 'Firmware and programmable logic',
        period: 'Minutes to hours',
        magnitude: 3.5,
        turn: 'Synthesise a design, flash it to an FPGA or microcontroller, measure it on the bench.',
        gatedBy: ['Leading-edge foundry capacity'],
        note:
          'Open toolchains make this loop fully automatable at bench scale, and nothing ' +
          'in the universe gates it there. It is gated at volume, by the same foundry ' +
          'capacity every other chip competes for.',
      },
      {
        id: 'parts',
        name: 'Printed and machined parts',
        period: 'Hours to days',
        magnitude: 5,
        turn: 'Print or mill a part, measure it, adjust the model, print again.',
        gatedBy: [
          'Didymium (Nd-Pr) metal, magnet feed',
          'Dysprosium metal',
          'Rare-earth magnet sintering',
          'Precision reduction drives',
          'Robot-grade encoders and force sensors',
        ],
        note:
          'The fastest loop that produces a physical object, and the first place a ' +
          'machine can improve its own body. Every axis that moves the tool is a motor, ' +
          'a drive and an encoder, which is why the actuation rows gate it.',
      },
      {
        id: 'boards',
        name: 'Circuit boards',
        period: 'One to two weeks',
        magnitude: 6,
        turn: 'Lay out a board, send it to a fab house, populate it, test it.',
        gatedBy: ['Gallium, refined', 'Silicon carbide substrate, 200 mm semi-insulating'],
        note:
          'The loop crosses a courier. Cost per turn is small; the period is set by ' +
          'logistics rather than physics. Power stages are where the compound ' +
          'semiconductor rows enter.',
      },
      {
        id: 'training',
        name: 'Frontier training run',
        period: 'Weeks to months',
        magnitude: 6.5,
        turn: 'Train a model on the current fleet, evaluate it, decide what the next run changes.',
        gatedBy: [
          'Leading-edge foundry capacity',
          'Advanced packaging capacity',
          'High-bandwidth memory stacking yield',
          'Large power transformer slots',
          'Grid interconnection queues',
        ],
        note:
          'The loop most people mean by recursive self-improvement, and not a software ' +
          'loop at all at the scale that matters: a run is a fleet of accelerators and the ' +
          'megawatts to feed them, both allocated years ahead.',
      },
      {
        id: 'silicon',
        name: 'Silicon',
        period: 'Months',
        magnitude: 7,
        turn: 'Tape out on a shuttle run, wait for the wafer, package it, test it.',
        gatedBy: [
          'EUV lithography scanners',
          'EUV projection optics',
          'Photoresist formulation',
          'High-purity tin, EUV droplet grade',
          'Neon, excimer laser grade',
          'Ruthenium, sputtering and ALD grade',
          '300 mm prime silicon wafers',
          'Electronic-grade polysilicon',
          'Crucible-grade high-purity quartz sand',
          'Semiconductor process engineers',
        ],
        note:
          'Open shuttles mean an agent can tape out. A turn is a quarter and real money, ' +
          'and the tool at the centre of it has one supplier. Most of the lithography ' +
          'and feedstock universe gates this layer.',
      },
      {
        id: 'energy',
        name: 'Energy',
        period: 'Months to years',
        magnitude: 7.5,
        turn: 'Bring a new megawatt to where the compute is.',
        gatedBy: [
          'Large power transformer slots',
          'Grid interconnection queues',
          'Heavy-duty gas turbine order books',
          'High-voltage cable and switchgear',
          'Grain-oriented electrical steel (GOES)',
          'REBCO superconducting tape, 12 mm',
          'Liquid helium (He-4)',
          'Two-phase dielectric immersion coolant',
          'CVD synthetic diamond heat spreader',
        ],
        note:
          'Not a layer of the loop so much as its power budget. Every faster layer above ' +
          'runs inside the megawatts this one delivers, and this firm’s thesis is that ' +
          'it binds before silicon does.',
      },
      {
        id: 'materials',
        name: 'Materials qualification',
        period: 'Years',
        magnitude: 8,
        turn: 'Qualify a second source of a grade, per process, per fab, per application.',
        gatedBy: [
          'High-purity tin, EUV droplet grade',
          'Neon, excimer laser grade',
          'Ruthenium, sputtering and ALD grade',
          'Electronic-grade polysilicon',
          '300 mm prime silicon wafers',
          'Crucible-grade high-purity quartz sand',
          'Gallium, refined',
          'CVD synthetic diamond heat spreader',
          'Silicon carbide substrate, 200 mm semi-insulating',
          'Two-phase dielectric immersion coolant',
          'Grain-oriented electrical steel (GOES)',
          'REBCO superconducting tape, 12 mm',
          'Liquid helium (He-4)',
          'Didymium (Nd-Pr) metal, magnet feed',
          'Dysprosium metal',
        ],
        note:
          'The slowest edge, and the one intelligence accelerates least: a substitute that ' +
          'exists in a laboratory and one that is qualified are different facts. This is ' +
          'the layer the whole coverage universe describes.',
      },
    ],
    questions: [
      {
        id: 'first-unattended-turn',
        question: 'Has a physical design → build → measure turn completed with no human in it?',
        whyItMatters:
          'It is the moment the loop stops being a metaphor. Until it happens, every ' +
          'hardware improvement has a person somewhere on its critical path.',
        settledBy:
          'A documented turn — part printed, measured by the same system, redesigned and ' +
          'reprinted — with no human action between the first print and the second.',
      },
      {
        id: 'which-layer-binds',
        question:
          'When agents begin commissioning hardware at scale, which layer binds first: packaging, power or magnets?',
        whyItMatters:
          'Three curves, three candidates. The one that binds first is where the price ' +
          'jumps and where the map is worth the most.',
        settledBy:
          'Lead-time and order-book data per layer, tracked over time. The layer whose ' +
          'lead time lengthens while the others hold is the answer.',
      },
      {
        id: 'materials-loop-or-wall',
        question: 'Is the materials layer a loop at all, or a wall the loop runs up against?',
        whyItMatters:
          'If qualification cannot be compressed, the fastest layers converge on the ' +
          'materials layer’s period and the whole recursion runs at years per turn.',
        settledBy:
          'A qualification cycle for a second-source grade completing in quarters rather ' +
          'than years. This is the thesis falsifier for “substitution is slow”, read here ' +
          'from the other side.',
      },
      {
        id: 'simulation-displaces-turns',
        question: 'How many physical turns does a simulated turn replace?',
        whyItMatters:
          'If most iterations move into simulation, the physical loop’s period matters ' +
          'less than its throughput — and the binding layer moves back up to compute.',
        settledBy:
          'The count of physical builds per unit of capability gain, falling over time in ' +
          'published robotics and hardware results.',
      },
      {
        id: 'energy-ceiling',
        question: 'Does energy set the ceiling on the fastest layer before silicon does?',
        whyItMatters:
          'The software scaffold loop turns in minutes only while the megawatts hold. ' +
          'If energy binds first, the fastest loop inherits the slowest period.',
        settledBy:
          'Announced compute capacity continuing to outrun energised capacity, with ' +
          'interconnection and transformer lead times as the stated cause.',
      },
    ],
    deliverables: [
      {
        id: 'layer-map',
        what: 'The layer map, with each layer’s period and the rows that gate it',
        status: 'done',
        detail:
          'This page. Every row named here exists in the coverage universe and is checked ' +
          'by a test, so the programme cannot cite a node the mandate has not admitted.',
      },
      {
        id: 'sourcing',
        what: 'A primary source on every row the programme cites',
        status: 'in-progress',
        detail:
          'The research engine searches for a source for each unverified row and files ' +
          'what it finds as a candidate. A row flips to sourced only when an analyst ' +
          'attaches the source, so the engine speeds the work without lowering the bar.',
      },
      {
        id: 'lead-time-clock',
        what: 'A lead-time clock per layer, tracked in public',
        status: 'not-started',
        detail:
          'Order-book and lead-time observations per layer, dated, so the “which layer ' +
          'binds first” question is answered by a series rather than an opinion.',
      },
      {
        id: 'bench-turn',
        what: 'One unattended physical turn, reproduced and documented',
        status: 'not-started',
        detail:
          'A printer, a camera and a caliper on a bench, driven end to end by an agent. ' +
          'The programme’s first question answered by doing it.',
      },
    ],
  },
];

export interface ProgrammeProgress {
  total: number;
  done: number;
  inProgress: number;
}

export function programmeProgress(programme: ResearchProgramme): ProgrammeProgress {
  return {
    total: programme.deliverables.length,
    done: programme.deliverables.filter((d) => d.status === 'done').length,
    inProgress: programme.deliverables.filter((d) => d.status === 'in-progress').length,
  };
}

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  done: 'Done',
  'in-progress': 'In progress',
  'not-started': 'Not started',
};

/** Every coverage row a programme cites, de-duplicated, in first-cited order. */
export function rowsCitedBy(programme: ResearchProgramme): string[] {
  return [...new Set(programme.layers.flatMap((layer) => layer.gatedBy))];
}
