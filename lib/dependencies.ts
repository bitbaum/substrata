/**
 * The dependency layer, indexed: what a bottleneck needs, what needs it, and
 * which companies rest on or sell into it. Pure reads of
 * `config/substrata-dependencies.ts`; X-ray and Scenarios both walk it.
 *
 * A walk only ever follows recorded rows, and every step it returns carries
 * the row that justified it, so a page can show the edge's evidence next to
 * the conclusion.
 */
import { DEPENDENCIES, type Dependency } from '@/config/substrata-dependencies';

export type { Dependency } from '@/config/substrata-dependencies';

/** Walks stop here. The recorded chain is four deep at most; this is a guard, not a model. */
export const MAX_DEPTH = 6;

export function inputsOf(bottleneck: string): Dependency[] {
  return DEPENDENCIES.filter((d) => d.fromKind === 'bottleneck' && d.from === bottleneck);
}

/** Bottlenecks that need this one as an input. */
export function dependentsOf(bottleneck: string): Dependency[] {
  return DEPENDENCIES.filter((d) => d.fromKind === 'bottleneck' && d.on === bottleneck);
}

export function companyEdges(company: string): Dependency[] {
  return DEPENDENCIES.filter((d) => d.fromKind === 'company' && d.from === company);
}

export function companiesOn(bottleneck: string): Dependency[] {
  return DEPENDENCIES.filter((d) => d.fromKind === 'company' && d.on === bottleneck);
}

/** One reached node and the chain of recorded rows that reached it. */
export interface Reach {
  bottleneck: string;
  /** From the start outward; `path[0]` leaves the start node. */
  path: Dependency[];
}

function walk(
  starts: readonly string[],
  next: (name: string) => Dependency[],
  target: (d: Dependency) => string,
): Reach[] {
  const seen = new Set(starts);
  const out: Reach[] = [];
  let frontier: Reach[] = starts.map((bottleneck) => ({ bottleneck, path: [] }));
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const following: Reach[] = [];
    for (const at of frontier) {
      for (const edge of next(at.bottleneck)) {
        const name = target(edge);
        if (seen.has(name)) continue;
        seen.add(name);
        const reach = { bottleneck: name, path: [...at.path, edge] };
        out.push(reach);
        following.push(reach);
      }
    }
    frontier = following;
  }
  return out;
}

/** Everything the starts need, transitively, shortest recorded path first. */
export function upstreamOf(starts: readonly string[]): Reach[] {
  return walk(starts, inputsOf, (d) => d.on);
}

/** Everything that needs the starts, transitively. */
export function downstreamOf(starts: readonly string[]): Reach[] {
  return walk(starts, dependentsOf, (d) => d.from);
}

/** "A → B → C", for a path read from its start. */
export function pathLabel(start: string, path: readonly Dependency[], upstream: boolean): string {
  return [start, ...path.map((d) => (upstream ? d.on : d.from))].join(' → ');
}
