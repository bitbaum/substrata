/**
 * "Constrained by": the chokepoints a company rests on, hardest binding
 * first, each with who holds it, who else could, and what stands behind it.
 *
 * Three ways in, strongest first:
 *   1. the company's own sentence (config/substrata-dependencies.ts): stated;
 *   2. a counted relation naming a supplier that holds a chokepoint: derived
 *      (it buys from a holder; the sentence names the holder, not the node);
 *   3. what the things it holds need as inputs: derived (it makes X; X needs Y).
 */
import type { Dependency } from '@/config/substrata-dependencies';
import type { Bottleneck } from '@/lib/bottlenecks';
import type { Neighbour } from '@/lib/graph/index';
import type { ExposureData } from './data';
import { isSubject, namesParty } from './match';
import { byBinding, refOf, sourceOf, uniqueBy } from './refs';
import type { Dependence, ExposureSource, Maker } from './types';

type Subject = { slug: string; name: string };

/** The supply edges that make `subject` a buyer from someone, by supplier slug or name. */
function suppliersNamed(data: ExposureData, subject: Subject) {
  return data
    .supplyEdges(`company:${subject.slug}`)
    .filter(
      (n) =>
        (n.direction === 'out' && n.relation.type === 'buys_from') ||
        (n.direction === 'in' && n.relation.type === 'supplies'),
    );
}

function edgeSources(n: Neighbour): ExposureSource[] {
  return n.relation.evidence.map((e) => ({ url: e.source, quote: e.quote, readOn: e.readOn }));
}

function makersOf(
  b: Bottleneck,
  subject: Subject,
  rows: readonly Dependency[],
  named: readonly Neighbour[],
  data: ExposureData,
): Maker[] {
  const makers = b.producers
    .filter((p) => p.name !== subject.name)
    .map((p): Maker => {
      const edge = named.find(
        (n) => n.node.name === p.name || data.slugOf(n.node.name) === data.slugOf(p.name),
      );
      const quoted = rows.find((d) => namesParty(d.quote, p.name));
      const stated = edge ?? quoted;
      return {
        name: p.name,
        slug: data.slugOf(p.name),
        role: p.role,
        supplier: p.supplier,
        grade: stated ? 'stated' : 'derived',
        basis: edge
          ? `Named as a supplier by a source, and holds ${b.name}.`
          : quoted
            ? `Named in the company’s own sentence, and holds ${b.name}.`
            : `Holds ${b.name}; the company’s sentence does not name it.`,
        sources: edge ? edgeSources(edge) : quoted ? [sourceOf(quoted)] : [],
        chain: stated ? [] : [`${p.name}: ${p.role} (directory row on ${b.name})`],
      };
    });
  return makers.sort(
    (a, c) =>
      Number(a.supplier) - Number(c.supplier) ||
      Number(c.grade === 'stated') - Number(a.grade === 'stated') ||
      a.name.localeCompare(c.name),
  );
}

function behind(b: Bottleneck, data: ExposureData) {
  const out = [];
  const seen = new Set([b.name]);
  let frontier = [b.name];
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const next: string[] = [];
    for (const from of frontier)
      for (const d of data.dependencies)
        if (d.fromKind === 'bottleneck' && d.from === from && !seen.has(d.on)) {
          seen.add(d.on);
          next.push(d.on);
          const input = data.bottlenecks.find((x) => x.name === d.on);
          if (input) out.push(refOf(input));
        }
    frontier = next;
  }
  return out.sort(byBinding).slice(0, 4);
}

function build(
  b: Bottleneck,
  subject: Subject,
  relation: Dependence['relation'],
  grade: Dependence['grade'],
  evidence: ExposureSource[],
  via: string | null,
  rows: readonly Dependency[],
  named: readonly Neighbour[],
  data: ExposureData,
): Dependence {
  const makers = makersOf(b, subject, rows, named, data);
  const cited = uniqueBy(
    [...evidence, ...makers.filter((m) => m.grade === 'stated').flatMap((m) => m.sources)],
    (e) => `${e.url}|${e.quote}`,
  );
  return {
    chokepoint: refOf(b),
    relation,
    grade,
    evidence: cited,
    via,
    makers,
    soleRecorded: makers.filter((m) => !m.supplier).length <= 1 && b.producers.length > 0,
    alternatives: data.substitutes
      .filter((s) => s.material === b.slug)
      .map((s) => ({
        candidate: s.candidate,
        status: s.status,
        blockedBy: s.blockedBy,
        why: s.why,
        sources: s.sources,
      })),
    judged: { substitution: b.score.substitution, leadTime: b.score.leadTime, on: b.judgedOn },
    behind: behind(b, data),
  };
}

export function dependences(subject: Subject, data: ExposureData): Dependence[] {
  const byName = new Map(data.bottlenecks.map((b) => [b.name, b]));
  const named = suppliersNamed(data, subject);
  const out: Dependence[] = [];

  // 1. The company's own sentences.
  const own = data.dependencies.filter(
    (d) => d.fromKind === 'company' && isSubject(d.from, subject),
  );
  for (const name of uniqueBy(own, (d) => d.on).map((d) => d.on)) {
    const b = byName.get(name);
    if (!b) continue;
    const rows = own.filter((d) => d.on === name);
    const relation = rows.some((d) => d.kind === 'needs') ? 'needs' : 'sells-into';
    out.push(build(b, subject, relation, 'stated', rows.map(sourceOf), null, rows, named, data));
  }

  // 2. A supplier it buys from holds a chokepoint it has no sentence about.
  for (const n of named) {
    for (const b of data.bottlenecks) {
      if (out.some((d) => d.chokepoint.name === b.name)) continue;
      if (
        !b.producers.some(
          (p) => p.name === n.node.name || data.slugOf(p.name) === data.slugOf(n.node.name),
        )
      )
        continue;
      const ev = edgeSources(n);
      out.push(build(b, subject, 'needs', 'derived', ev, null, [], [n], data));
    }
  }

  // 3. What the things it makes need as inputs.
  for (const h of data.held(subject.slug).filter((x) => !x.supplier)) {
    for (const d of data.dependencies) {
      if (d.fromKind !== 'bottleneck' || d.from !== h.bottleneck) continue;
      const b = byName.get(d.on);
      if (!b || out.some((x) => x.chokepoint.name === b.name)) continue;
      out.push(
        build(b, subject, 'needs', 'derived', [sourceOf(d)], h.bottleneck, [d], named, data),
      );
    }
  }

  return out.sort(
    (a, c) =>
      byBinding(a.chokepoint, c.chokepoint) ||
      Number(c.grade === 'stated') - Number(a.grade === 'stated'),
  );
}
