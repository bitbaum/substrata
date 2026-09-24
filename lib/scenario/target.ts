/**
 * What a scenario can knock out, and how it is written in a URL.
 *
 * `?at=company:carl-zeiss-smt`, `?at=bottleneck:gallium-refined`,
 * `?at=country:CN&only=gallium-refined` — the address is the whole scenario,
 * so a link is the thing a reader shares. Only nodes the corpus records can
 * be picked: a company that holds a bottleneck, a bottleneck, or a country
 * where a recorded maker (or a maker-less bottleneck) sits.
 */
import { BOTTLENECKS, bottleneckBySlug } from '@/lib/bottlenecks';
import { makerGeography } from '@/lib/bottleneck-makers';
import { MARKET_PARTICIPANTS } from '@/lib/participants';

export type Target =
  | { kind: 'company'; slug: string; name: string }
  | { kind: 'bottleneck'; slug: string; name: string }
  | { kind: 'country'; code: string; name: string };

export interface Scenario {
  at: Target;
  /** Bottleneck slugs the scenario is restricted to ("halts exports of gallium"); empty = all. */
  only: string[];
}

const regions = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string): string {
  try {
    return regions.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

const PRODUCER_NAMES = new Set(BOTTLENECKS.flatMap((b) => b.producers.map((p) => p.name)));

/** Companies that hold at least one bottleneck: the only ones whose loss the corpus can trace. */
export function companyTargets(): Extract<Target, { kind: 'company' }>[] {
  return MARKET_PARTICIPANTS.filter((p) => PRODUCER_NAMES.has(p.name))
    .map((p) => ({ kind: 'company' as const, slug: p.slug, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function countryTargets(): Extract<Target, { kind: 'country' }>[] {
  const codes = new Set(BOTTLENECKS.flatMap((b) => [...makerGeography(b).countries.keys()]));
  for (const b of BOTTLENECKS) for (const p of b.producers) for (const c of p.jurisdictions) codes.add(c);
  return [...codes]
    .filter((c) => /^[A-Z]{2}$/.test(c))
    .map((code) => ({ kind: 'country' as const, code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function bottleneckTargets(): Extract<Target, { kind: 'bottleneck' }>[] {
  return BOTTLENECKS.map((b) => ({ kind: 'bottleneck' as const, slug: b.slug, name: b.name })).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
}

export function targetId(t: Target): string {
  return t.kind === 'country' ? `country:${t.code}` : `${t.kind}:${t.slug}`;
}

export function parseTarget(value: string | undefined): Target | null {
  if (!value) return null;
  const [kind, key] = value.split(':', 2);
  if (!key) return null;
  if (kind === 'company') return companyTargets().find((t) => t.slug === key) ?? null;
  if (kind === 'bottleneck') return bottleneckTargets().find((t) => t.slug === key) ?? null;
  if (kind === 'country') return countryTargets().find((t) => t.code === key.toUpperCase()) ?? null;
  return null;
}

type Params = Record<string, string | string[] | undefined>;

export function parseScenario(params: Params): Scenario | null {
  const at = parseTarget(typeof params.at === 'string' ? params.at : undefined);
  if (!at) return null;
  const raw = typeof params.only === 'string' ? params.only.split(',') : [];
  const only = raw.filter((slug) => bottleneckBySlug(slug)).slice(0, 12);
  return { at, only: at.kind === 'bottleneck' ? [] : only };
}

export function scenarioHref(s: { at: Target; only?: readonly string[] }): string {
  const q = new URLSearchParams({ at: targetId(s.at) });
  if (s.only && s.only.length > 0) q.set('only', s.only.join(','));
  return `/scenarios?${q.toString()}`;
}

export function scenarioTitle(s: Scenario): string {
  const what =
    s.only.length > 0
      ? ` stops supplying ${s.only.map((slug) => bottleneckBySlug(slug)?.name ?? slug).join(', ')}`
      : ' goes offline';
  return `${s.at.name}${what}`;
}
