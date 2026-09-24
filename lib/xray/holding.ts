/**
 * One holding, X-rayed: the bottlenecks its companies hold, the ones they
 * rest on (by a filing sentence, or upstream through recorded inputs), and
 * the supplier risks along the way.
 *
 * Every rail carries the evidence that put it there. Upstream walks start
 * only from rails the company MAKES or RUNS — a part supplier is not a maker
 * of the scanner, so Zeiss's X-ray does not inherit the scanner's tin — and
 * from bottlenecks a filing says the company needs. A "sells into" row is
 * shown and not walked: it is a market, not an input.
 */
import { BOTTLENECKS, type Bottleneck } from '@/lib/bottlenecks';
import { exposureRows, type ExposureRow } from '@/lib/exposure';
import { companyEdges, upstreamOf, type Dependency } from '@/lib/dependencies';
import { listingForName } from '@/lib/listings';
import { makersOf } from '@/lib/bottleneck-makers';
import { participantBySlug } from '@/lib/participants';

export interface EdgeEvidence {
  from: string;
  on: string;
  kind: Dependency['kind'];
  source: string;
  quote: string;
  primary: boolean;
  scope: string | null;
}

export interface HeldRail {
  bottleneck: string;
  slug: string;
  company: string;
  role: string;
  supplier: boolean;
  /** Other recorded makers; a part supplier never counts as one. */
  otherMakers: number;
  verification: ExposureRow['verification'];
  evidence: string | null;
}

export interface DependedRail {
  bottleneck: string;
  slug: string;
  company: string;
  relation: 'needs' | 'sells-into' | 'upstream';
  /** The recorded rows from the company (or its held rail) to this bottleneck. */
  path: EdgeEvidence[];
  /** Where the walk started: the company, or a bottleneck it holds. */
  start: string;
}

export type RiskKind = 'no-maker' | 'sole-maker' | 'private-maker' | 'private-part';

export interface SupplierRisk {
  bottleneck: string;
  slug: string;
  kind: RiskKind;
  /** The organisation the risk is about; null for a bottleneck with no recorded maker. */
  company: string | null;
}

export interface HoldingXray {
  companies: { name: string; slug: string }[];
  held: HeldRail[];
  depends: DependedRail[];
  risks: SupplierRisk[];
}

const BY_NAME = new Map(BOTTLENECKS.map((b) => [b.name, b]));

function evidenceOf(d: Dependency): EdgeEvidence {
  return {
    from: d.from,
    on: d.on,
    kind: d.kind,
    source: d.source,
    quote: d.quote,
    primary: d.primary,
    scope: d.scope ?? null,
  };
}

/** Sole-maker and private-supplier risks on one bottleneck, from its producer rows. */
export function risksOn(b: Bottleneck): SupplierRisk[] {
  const out: SupplierRisk[] = [];
  const makerRows = makersOf(b);
  if (makerRows.length === 0)
    out.push({ bottleneck: b.name, slug: b.slug, kind: 'no-maker', company: null });
  if (makerRows.length === 1)
    out.push({ bottleneck: b.name, slug: b.slug, kind: 'sole-maker', company: makerRows[0].name });
  for (const p of b.producers) {
    // Only a settled "private" counts: "none-found" means the lookup found
    // nothing, which is not the same as the company having no shares.
    if (listingForName(p.name)?.status === 'private')
      out.push({
        bottleneck: b.name,
        slug: b.slug,
        kind: p.supplier ? 'private-part' : 'private-maker',
        company: p.name,
      });
  }
  return out;
}

export function xrayCompanies(slugs: readonly string[], now: Date = new Date()): HoldingXray {
  const companies = slugs.flatMap((slug) => {
    const p = participantBySlug(slug);
    return p ? [{ name: p.name, slug: p.slug }] : [];
  });
  const names = new Set(companies.map((c) => c.name));
  const held: HeldRail[] = exposureRows(now)
    .filter((r) => names.has(r.company))
    .map((r) => ({
      bottleneck: r.bottleneck,
      slug: r.bottleneckSlug,
      company: r.company,
      role: r.role,
      supplier: r.supplier,
      otherMakers: r.otherMakers,
      verification: r.verification,
      evidence: r.evidence,
    }));

  const depends: DependedRail[] = [];
  const seen = new Set(held.map((h) => `${h.bottleneck}|held`));
  const push = (rail: DependedRail) => {
    const key = `${rail.bottleneck}|${rail.relation === 'sells-into' ? 'sells' : 'dep'}`;
    if (seen.has(key) || seen.has(`${rail.bottleneck}|held`)) return;
    seen.add(key);
    depends.push(rail);
  };

  for (const c of companies) {
    for (const edge of companyEdges(c.name)) {
      const b = BY_NAME.get(edge.on);
      if (!b) continue;
      push({
        bottleneck: b.name,
        slug: b.slug,
        company: c.name,
        relation: edge.kind === 'sells-into' ? 'sells-into' : 'needs',
        path: [evidenceOf(edge)],
        start: c.name,
      });
    }
  }

  const starts = [
    ...held
      .filter((h) => !h.supplier)
      .map((h) => ({ from: h.bottleneck, company: h.company, lead: [] as EdgeEvidence[] })),
    ...depends
      .filter((d) => d.relation === 'needs')
      .map((d) => ({ from: d.bottleneck, company: d.company, lead: d.path })),
  ];
  for (const start of starts) {
    for (const reach of upstreamOf([start.from])) {
      const b = BY_NAME.get(reach.bottleneck);
      if (!b) continue;
      push({
        bottleneck: b.name,
        slug: b.slug,
        company: start.company,
        relation: 'upstream',
        path: [...start.lead, ...reach.path.map(evidenceOf)],
        start: start.lead.length > 0 ? start.company : start.from,
      });
    }
  }

  const railNames = new Set([
    ...held.map((h) => h.bottleneck),
    ...depends.map((d) => d.bottleneck),
  ]);
  const risks = [...railNames].flatMap((name) => {
    const b = BY_NAME.get(name);
    // A company is not a supplier risk to itself.
    return b ? risksOn(b).filter((r) => !r.company || !names.has(r.company)) : [];
  });

  return { companies, held, depends, risks };
}
