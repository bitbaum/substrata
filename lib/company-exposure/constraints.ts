/**
 * "Constrains": what a company holds that others wait on, and who they are.
 *
 * A waiting party is a company whose OWN source says it needs the chokepoint
 * (or sells into it). That the holder is the one it waits on is derived from
 * two rows: stated when its sentence also names the holder. Past one step it
 * is a lead on the page and never counted.
 */
import type { Dependency } from '@/config/substrata-dependencies';
import type { Bottleneck } from '@/lib/bottlenecks';
import type { ExposureData } from './data';
import { namesParty } from './match';
import { byBinding, refOf, sourceOf, uniqueBy } from './refs';
import type { Constraint, NamedParty, Waiting } from './types';

type Subject = { slug: string; name: string };

function waitingOn(
  rows: readonly Dependency[],
  b: Bottleneck,
  subject: Subject,
  data: ExposureData,
  through: string | null,
): Waiting[] {
  return uniqueBy(
    rows.filter((d) => d.fromKind === 'company'),
    (d) => `${d.from}|${d.kind}`,
  ).map((d): Waiting => {
    const stated = through === null && namesParty(d.quote, subject.name);
    return {
      name: d.from,
      slug: data.slugOf(d.from),
      relation: d.kind,
      grade: stated ? 'stated' : 'derived',
      basis: through
        ? `${d.from} ${d.kind === 'needs' ? 'needs' : 'sells into'} ${b.name}, which needs ${through}, which ${subject.name} holds.`
        : d.kind === 'needs'
          ? namesParty(d.quote, subject.name)
            ? `${d.from} names ${subject.name} in the sentence that says it needs ${b.name}.`
            : `${d.from} says it needs ${b.name}; ${subject.name} is one of ${b.producers.filter((p) => !p.supplier).length} recorded makers, and the sentence does not name it.`
          : `${d.from} says its market is the holders of ${b.name}; ${subject.name} is one.`,
      sources: [sourceOf(d)],
      chain: stated ? [] : [`${subject.name} holds ${b.name} (directory row)`],
    };
  });
}

export function constraints(subject: Subject, data: ExposureData): Constraint[] {
  const out: Constraint[] = [];
  for (const h of data.held(subject.slug)) {
    const b = data.bottlenecks.find((x) => x.name === h.bottleneck);
    if (!b) continue;
    const direct = data.dependencies.filter((d) => d.on === b.name);
    const waiting = waitingOn(direct, b, subject, data, null);
    if (h.supplier) {
      // A part supplier is waited on by the makers of the thing it goes into.
      for (const p of b.producers.filter((x) => !x.supplier && x.name !== subject.name))
        waiting.push({
          name: p.name,
          slug: data.slugOf(p.name),
          relation: 'needs',
          grade: 'derived',
          basis: `${subject.name} supplies a part of ${b.name}, which ${p.name} makes.`,
          sources: [],
          chain: [
            `${subject.name}: ${h.step} (directory row on ${b.name})`,
            `${p.name}: ${p.role} (directory row on ${b.name})`,
          ],
        });
    }
    const feeds = data.dependencies
      .filter((d) => d.fromKind === 'bottleneck' && d.on === b.name)
      .flatMap((d) => data.bottlenecks.filter((x) => x.name === d.from));
    const have = new Set(waiting.map((w) => w.name));
    const reached = uniqueBy(
      feeds.flatMap((f) =>
        waitingOn(
          data.dependencies.filter((d) => d.on === f.name && d.kind === 'needs'),
          f,
          subject,
          data,
          b.name,
        ),
      ),
      (w) => w.name,
    ).filter((w) => !have.has(w.name));
    if (waiting.length === 0 && feeds.length === 0) continue;
    out.push({
      chokepoint: refOf(b),
      step: h.step,
      supplier: h.supplier,
      waiting,
      feeds: feeds.map(refOf).sort(byBinding),
      reached,
    });
  }
  return out.sort((a, c) => byBinding(a.chokepoint, c.chokepoint));
}

/** Customers a source names directly, from the relation graph. */
export function namedCustomers(subject: Subject, data: ExposureData): NamedParty[] {
  return data
    .supplyEdges(`company:${subject.slug}`)
    .filter(
      (n) =>
        (n.direction === 'out' && n.relation.type === 'supplies') ||
        (n.direction === 'in' && n.relation.type === 'buys_from'),
    )
    .map((n) => ({
      direction: 'customer' as const,
      name: n.node.name,
      slug: data.slugOf(n.node.name),
      grade: n.relation.grade,
      basis: `${n.node.name} is named as a customer of ${subject.name}.`,
      sources: n.relation.evidence.map((e) => ({
        url: e.source,
        quote: e.quote,
        readOn: e.readOn,
      })),
      chain: [],
    }));
}
