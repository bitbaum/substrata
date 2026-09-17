/**
 * What everything on this site is ultimately about.
 *
 * Substrata's subject is the rate at which technology improves, and the model
 * it uses is loops: design → build → measure, turned as fast as the slowest
 * thing in the way allows. A loop that takes a year to turn improves a hundred
 * times more slowly than one that turns in a day, so the question worth asking
 * of any company, material, rule or mandate is not "is it important" but
 * "which loop does it hold up, and how hard".
 *
 * That makes the loops the KPI, and every entity's role in them a traversal:
 * entity → the bottlenecks it touches → the loops those bottlenecks gate.
 *
 * ## What this must never do
 *
 * `binding` is a DATED JUDGEMENT on a 0–12 scale, not a measurement. Adding
 * judgements together produces a number that looks like data and is not, so
 * nothing here returns a single score for the whole system. What it returns is
 * the worst judgement, how many gates are judged to bite today, and the dates —
 * so a reader can see what the figure is made of and disagree with it.
 */
import { RESEARCH_PROGRAMMES } from '@/config/substrata-programmes';
import { bottleneckBySlug, type Bottleneck } from '../bottlenecks';
import { entityId } from '../entities/types';
import { resolveEntity, resolveIn } from '../entities/registry';
import { connectionsOf } from '../relations/registry';
import type { Entity, EntityId } from '../entities/types';

/** A bottleneck in the way of a loop, with the judgement that says how badly. */
export interface Gate {
  entity: Entity;
  bottleneck: Bottleneck;
  /** 0–12. A judgement, dated, not a measurement. */
  binding: number;
  /** Whether it is judged to bite now, or later. */
  horizon: Bottleneck['horizon'];
  /** How well the row itself is evidenced. */
  state: string;
  judgedOn: string;
}

export interface Loop {
  id: string;
  name: string;
  /** How long one turn takes, in words. */
  period: string;
  /** log10 seconds, so loops can be compared on one axis. */
  magnitude: number;
  turn: string;
  programme: string;
  gates: Gate[];
  /** The worst single judgement among the gates — not a sum. */
  worstBinding: number;
  /** How many gates are judged to bite today. */
  bindingNow: number;
  /** The most recent date any of these judgements was made. */
  judgedOn: string | null;
}

function gatesFor(names: string[]): Gate[] {
  const gates: Gate[] = [];
  for (const name of names) {
    const entity = resolveIn('bottleneck', name);
    if (!entity) continue;
    const bottleneck = bottleneckBySlug(entity.key);
    if (!bottleneck) continue;
    gates.push({
      entity,
      bottleneck,
      binding: bottleneck.binding,
      horizon: bottleneck.horizon,
      state: bottleneck.state,
      judgedOn: bottleneck.judgedOn,
    });
  }
  return gates.sort((a, b) => b.binding - a.binding);
}

let cache: Loop[] | null = null;

/** Every loop the programme is trying to close, worst-blocked first. */
export function loops(): Loop[] {
  if (cache) return cache;
  const built: Loop[] = [];
  for (const programme of RESEARCH_PROGRAMMES) {
    for (const layer of programme.layers) {
      const gates = gatesFor(layer.gatedBy);
      const dates = gates.map((g) => g.judgedOn).sort();
      built.push({
        id: layer.id,
        name: layer.name,
        period: layer.period,
        magnitude: layer.magnitude,
        turn: layer.turn,
        programme: programme.title,
        gates,
        worstBinding: gates.reduce((worst, gate) => Math.max(worst, gate.binding), 0),
        bindingNow: gates.filter((gate) => gate.horizon === 'now').length,
        judgedOn: dates.at(-1) ?? null,
      });
    }
  }
  cache = built.sort((a, b) => b.worstBinding - a.worstBinding || a.magnitude - b.magnitude);
  return cache;
}

/** One entity's role in the goal: which loops it holds up, and through what. */
export interface Role {
  loop: Loop;
  /** The bottleneck through which this entity reaches the loop. */
  through: Entity;
  /** How this entity touches that bottleneck, in the relation's own words. */
  via: string;
  /** How well THAT join is evidenced. */
  evidence: string;
}

/**
 * The path from anything to the loops it plays a role in.
 *
 * A bottleneck gates loops directly. Everything else — a company, a rule, a
 * mandate, a country — reaches them through the bottlenecks it is joined to,
 * which is why the relation layer carries evidence: the strength of the claim
 * "this firm holds up that loop" is the strength of its weakest join.
 */
export function rolesOf(id: EntityId): Role[] {
  const entity = resolveEntity(id);
  if (!entity) return [];

  const reached: Role[] = [];
  const seen = new Set<string>();

  const addFor = (bottleneck: Entity, via: string, evidence: string) => {
    for (const loop of loops()) {
      if (!loop.gates.some((gate) => gate.entity.id === bottleneck.id)) continue;
      const at = `${loop.id}:${bottleneck.id}`;
      if (seen.has(at)) continue;
      seen.add(at);
      reached.push({ loop, through: bottleneck, via, evidence });
    }
  };

  if (entity.kind === 'bottleneck') {
    addFor(entity, 'is the constraint', entity.evidence);
    return reached;
  }

  for (const connection of connectionsOf(entity.id)) {
    const other = resolveEntity(connection.other);
    if (other?.kind === 'bottleneck') addFor(other, connection.label, connection.evidence);
  }
  return reached;
}

/** Convenience for callers holding a kind and a key rather than an id. */
export function rolesIn(kind: Entity['kind'], key: string): Role[] {
  return rolesOf(entityId(kind, key));
}

/**
 * The state of the goal, as a set of dated judgements rather than a score.
 *
 * Deliberately not a single number: a composite of judgements reads as a
 * measurement of the world, and it is not one.
 */
export function loopSummary(): {
  loops: number;
  blocked: number;
  worstBinding: number;
  judgedOn: string | null;
} {
  const all = loops();
  const dates = all.flatMap((loop) => (loop.judgedOn ? [loop.judgedOn] : [])).sort();
  return {
    loops: all.length,
    blocked: all.filter((loop) => loop.bindingNow > 0).length,
    worstBinding: all.reduce((worst, loop) => Math.max(worst, loop.worstBinding), 0),
    judgedOn: dates.at(-1) ?? null,
  };
}
