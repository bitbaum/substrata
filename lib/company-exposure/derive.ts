/**
 * What constrains a company, what it constrains, what it holds and what it
 * does not yet say. Design: docs/architecture/2026-10-27-company-exposure.md.
 *
 * Pure over `ExposureData`: nothing here invents a row. An edge exists
 * because a sentence or two directory rows say it, and every derived edge
 * names the rows it follows from.
 */
import { constraints, namedCustomers } from './constraints';
import { COUNTERPARTIES_FULL } from '@/lib/dossier/boxes/company';
import { corpus, type ExposureData } from './data';
import { dependences } from './dependences';
import { refOf, uniqueBy } from './refs';
import type { CompanyExposure, NamedParty, Unknown } from './types';

type Subject = { slug: string; name: string };

function namedSuppliers(
  subject: Subject,
  data: ExposureData,
  onChokepoint: Set<string>,
): NamedParty[] {
  return data
    .supplyEdges(`company:${subject.slug}`)
    .filter(
      (n) =>
        ((n.direction === 'out' && n.relation.type === 'buys_from') ||
          (n.direction === 'in' && n.relation.type === 'supplies')) &&
        !onChokepoint.has(n.node.name),
    )
    .map((n) => ({
      direction: 'supplier' as const,
      name: n.node.name,
      slug: data.slugOf(n.node.name),
      grade: n.relation.grade,
      basis: `${subject.name} is named as a buyer from ${n.node.name}.`,
      sources: n.relation.evidence.map((e) => ({
        url: e.source,
        quote: e.quote,
        readOn: e.readOn,
      })),
      chain: [],
    }));
}

export function companyExposure(subject: Subject, data: ExposureData = corpus()): CompanyExposure {
  const constrainedBy = dependences(subject, data);
  const constrain = constraints(subject, data);
  const holdsRows = data
    .held(subject.slug)
    .flatMap((h) => {
      const b = data.bottlenecks.find((x) => x.name === h.bottleneck);
      return b ? [{ chokepoint: refOf(b), step: h.step, supplier: h.supplier }] : [];
    })
    .sort((a, b) => b.chokepoint.binding - a.chokepoint.binding);

  const makerNames = new Set(constrainedBy.flatMap((d) => d.makers.map((m) => m.name)));
  const waitingNames = new Set(constrain.flatMap((c) => c.waiting.map((w) => w.name)));
  const named = uniqueBy(
    [
      ...namedSuppliers(subject, data, makerNames),
      ...namedCustomers(subject, data).filter((n) => !waitingNames.has(n.name)),
    ],
    (n) => `${n.direction}|${n.name}`,
  );
  const customers = named.filter((n) => n.direction === 'customer');

  const unknown: Unknown[] = [];
  if (constrainedBy.length === 0 && named.every((n) => n.direction !== 'supplier'))
    unknown.push({
      side: 'constrained-by',
      missing: `Nothing ${subject.name} depends on is recorded with a source yet: no sentence of its own, and no supplier named by a source.`,
      box: 'suppliers',
    });
  const waitingOrganisations = new Set([
    ...constrain.flatMap((c) => c.waiting.filter((w) => w.relation === 'needs').map((w) => w.name)),
    ...customers.map((c) => c.name),
  ]);
  if (waitingOrganisations.size === 0)
    unknown.push({
      side: 'constrains',
      missing: `No organisation is recorded as waiting on ${subject.name}: no customer names it, and it holds no chokepoint others are recorded to need.`,
      box: 'customers',
    });
  else if (waitingOrganisations.size < COUNTERPARTIES_FULL && constrain.length === 0)
    unknown.push({
      side: 'constrains',
      missing: `${waitingOrganisations.size === 1 ? 'One organisation is' : `${waitingOrganisations.size} organisations are`} recorded as waiting on ${subject.name}, which is thin: the customers it is allocated to are mostly unnamed in what has been read.`,
      box: 'customers',
    });
  for (const d of constrainedBy)
    if (d.soleRecorded && d.alternatives.length === 0)
      unknown.push({
        side: 'alternatives',
        missing: `${d.chokepoint.name}: one maker is recorded and no alternative is written down, so how long a second source would take to qualify is not known.`,
        box: 'suppliers',
      });

  return {
    slug: subject.slug,
    name: subject.name,
    constrainedBy,
    constrains: constrain,
    holds: holdsRows,
    named,
    unknown,
    counts: {
      exposedTo: constrainedBy.length,
      constrainsOrganisations: waitingOrganisations.size,
      constrainsChokepoints: new Set(constrain.flatMap((c) => c.feeds.map((f) => f.name))).size,
      holds: holdsRows.length,
      tracked: data.bottlenecks.length,
    },
  };
}
