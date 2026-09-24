/**
 * A whole portfolio, X-rayed: each holding resolved and analysed, then the
 * rails and countries the portfolio as a whole rests on.
 *
 * Pure and stateless. Called inside one request with the reader's text and
 * nothing else; the holdings are never written anywhere, which is what the
 * page promises.
 */
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { netPressure, PRESSURE_WINDOW_DAYS } from '@/lib/exposure';
import type { BindingScore, Horizon } from '@/config/substrata-assessment';
import type { StageId } from '@/config/substrata-stages';
import { allMakersIn, makerGeography } from '@/lib/bottleneck-makers';
import { parseHoldings, type ParsedHolding } from './parse';
import { resolveHolding, resolveName, type Resolution, type Security } from './resolve';
import { xrayCompanies, type HoldingXray, type SupplierRisk } from './holding';

export interface ResolvedHolding extends HoldingXray {
  input: string;
  security: Security;
  /** Share of the resolved portfolio, 0–1; null when weights were given and this line had none. */
  weight: number | null;
}

export interface UnresolvedHolding {
  input: string;
  reason: string;
}

export type RailRelation = 'holds' | 'part' | 'needs' | 'sells-into' | 'upstream';

export interface PortfolioRail {
  bottleneck: string;
  slug: string;
  stage: StageId;
  binding: number;
  score: BindingScore;
  horizon: Horizon;
  netPressure: number;
  jurisdictions: string[];
  holdings: { label: string; relation: RailRelation }[];
  /** Share of portfolio weight touching this rail, 0–1. */
  weight: number;
}

export interface CountryConcentration {
  country: string;
  /** Share of portfolio weight resting on a rail whose every recorded maker is here, 0–1. */
  allWeight: number;
  /** Share of portfolio weight resting on a rail with at least one recorded maker here, 0–1. */
  someWeight: number;
  /** Rails whose every recorded maker (or only recorded location) is here. */
  allRails: string[];
  /** Rails with some, not all, recorded makers here. */
  someRails: string[];
}

export interface EventRow {
  id: string;
  date: string;
  headline: string;
  effect: string;
  bottleneck: string;
  source: string;
}

export interface PortfolioXray {
  holdings: ResolvedHolding[];
  unresolved: UnresolvedHolding[];
  weighted: boolean;
  rails: PortfolioRail[];
  countries: CountryConcentration[];
  risks: (SupplierRisk & { holdings: string[] })[];
  events: EventRow[];
  pressureWindowDays: number;
}

const BY_NAME = new Map(BOTTLENECKS.map((b) => [b.name, b]));

function reasonOf(r: Exclude<Resolution, { status: 'resolved' }>): string {
  if (r.status === 'ambiguous') return `Ambiguous: add the exchange (${r.candidates.join(', ')}).`;
  if (r.status === 'private') return `Private company, no shares to hold: ${r.note}`;
  return r.note;
}

function relationOf(x: HoldingXray, bottleneck: string): RailRelation | null {
  const held = x.held.filter((h) => h.bottleneck === bottleneck);
  if (held.some((h) => !h.supplier)) return 'holds';
  if (held.length > 0) return 'part';
  return x.depends.find((d) => d.bottleneck === bottleneck)?.relation ?? null;
}

export function xrayPortfolio(input: string, now: Date = new Date()): PortfolioXray {
  const parsed = parseHoldings(input);
  const holdings: ResolvedHolding[] = [];
  const unresolved: UnresolvedHolding[] = parsed.rejected.flatMap((line) => {
    const byName = resolveName(line);
    if (byName?.status === 'resolved') {
      holdings.push({
        input: line,
        security: byName.security,
        weight: null,
        ...xrayCompanies(byName.slugs, now),
      });
      return [];
    }
    return [
      {
        input: line,
        reason: byName ? reasonOf(byName) : 'Not a ticker in any form this page reads.',
      },
    ];
  });
  const rawWeights: (number | null)[] = holdings.map(() => null);

  for (const h of parsed.holdings as ParsedHolding[]) {
    const r = resolveHolding(h);
    if (r.status !== 'resolved') {
      unresolved.push({ input: h.raw, reason: reasonOf(r) });
      continue;
    }
    holdings.push({
      input: h.raw,
      security: r.security,
      weight: null,
      ...xrayCompanies(r.slugs, now),
    });
    rawWeights.push(h.weight);
  }
  if (parsed.truncated)
    unresolved.push({ input: '…', reason: 'Only the first 200 holdings are read.' });

  const weighted = rawWeights.some((w) => w !== null);
  const total = weighted ? rawWeights.reduce<number>((s, w) => s + (w ?? 0), 0) : holdings.length;
  holdings.forEach((h, i) => {
    const w = weighted ? rawWeights[i] : 1;
    h.weight = w === null || total === 0 ? null : w / total;
  });

  const rails = new Map<string, PortfolioRail>();
  for (const h of holdings) {
    const names = new Set([
      ...h.held.map((r) => r.bottleneck),
      ...h.depends.map((d) => d.bottleneck),
    ]);
    for (const name of names) {
      const b = BY_NAME.get(name);
      const relation = relationOf(h, name);
      if (!b || !relation) continue;
      const rail = rails.get(name) ?? {
        bottleneck: b.name,
        slug: b.slug,
        stage: b.stage,
        binding: b.binding,
        score: b.score,
        horizon: b.horizon,
        netPressure: netPressure(b, now),
        jurisdictions: b.jurisdictions,
        holdings: [],
        weight: 0,
      };
      rail.holdings.push({ label: h.security.label, relation });
      rail.weight += h.weight ?? 0;
      rails.set(name, rail);
    }
  }

  const countries = new Map<string, CountryConcentration>();
  for (const h of holdings) {
    const touched = [...rails.values()].filter((r) =>
      r.holdings.some((x) => x.label === h.security.label),
    );
    const all = new Map<string, Set<string>>();
    const some = new Map<string, Set<string>>();
    for (const rail of touched) {
      const b = BY_NAME.get(rail.bottleneck);
      if (!b) continue;
      const geo = makerGeography(b);
      for (const c of geo.countries.keys()) {
        const bucket = allMakersIn(geo, c) ? all : some;
        bucket.set(c, (bucket.get(c) ?? new Set()).add(rail.bottleneck));
      }
    }
    for (const c of new Set([...all.keys(), ...some.keys()])) {
      const row = countries.get(c) ?? {
        country: c,
        allWeight: 0,
        someWeight: 0,
        allRails: [],
        someRails: [],
      };
      if (all.has(c)) {
        row.allWeight += h.weight ?? 0;
        row.allRails = [...new Set([...row.allRails, ...all.get(c)!])];
      }
      if (some.has(c) || all.has(c)) row.someWeight += h.weight ?? 0;
      if (some.has(c)) row.someRails = [...new Set([...row.someRails, ...some.get(c)!])];
      countries.set(c, row);
    }
  }

  const risks = new Map<string, SupplierRisk & { holdings: string[] }>();
  for (const h of holdings)
    for (const r of h.risks) {
      const key = `${r.bottleneck}|${r.kind}|${r.company}`;
      const row = risks.get(key) ?? { ...r, holdings: [] };
      if (!row.holdings.includes(h.security.label)) row.holdings.push(h.security.label);
      risks.set(key, row);
    }

  const since = new Date(now.getTime() - PRESSURE_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const events = [...rails.keys()]
    .flatMap((name) =>
      (BY_NAME.get(name)?.events ?? [])
        .filter((e) => e.date >= since)
        .map((e) => ({
          id: e.id,
          date: e.date,
          headline: e.headline,
          effect: e.effect,
          bottleneck: name,
          source: e.source,
        })),
    )
    .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    holdings,
    unresolved,
    weighted,
    rails: [...rails.values()].sort((a, b) => b.weight - a.weight || b.binding - a.binding),
    countries: [...countries.values()].sort(
      (a, b) => b.allWeight - a.allWeight || b.someWeight - a.someWeight,
    ),
    risks: [...risks.values()],
    events,
    pressureWindowDays: PRESSURE_WINDOW_DAYS,
  };
}
