/**
 * A bottleneck as a route: every step upstream and downstream of it, two
 * levels each way, in the order material actually moves — and where each
 * step is made, so the same route can be read as a diagram (AtlasChain) and
 * laid over the Earth (the world view's ?chain=).
 *
 * Built only from records already on file: the dependency edges of the graph
 * (config/substrata-dependencies.ts via lib/graph) and each bottleneck's
 * producer rows and jurisdictions. Nothing is inferred. Where a step has no
 * maker on record, its jurisdictions stand in, and when it has neither it is
 * drawn on the diagram but not on the globe.
 */
import { BOTTLENECKS, bottleneckBySlug, type Bottleneck } from '@/lib/bottlenecks';
import { neighbors } from '@/lib/graph';
import { chainHref, countryName } from './chain-data';

/** How far the route reaches each way. Two keeps it on one screen. */
export const ROUTE_DEPTH = 2;
/** Producing countries drawn per step on the globe; the rest are listed. */
const COUNTRIES_PER_STEP = 5;

export interface RouteStep {
  slug: string;
  name: string;
  /** Negative upstream, 0 the bottleneck itself, positive downstream. */
  level: number;
  /** 1 at the far upstream end: the order a reader follows it in. */
  step: number;
  /** Where it is made, maker countries first, lower-case ISO-2. */
  isos: string[];
  binding: number;
  href: string;
  /** Steps past the edge of the route, so the reader knows it goes on. */
  beyond: number;
}

export interface ChainRoute {
  steps: RouteStep[];
  /** Input → consumer, by slug, between steps on the route. */
  edges: [string, string][];
  /** One arc per hop on the globe, country to country. */
  hops: { from: string; to: string }[];
  /** Labels at the countries, the bottleneck's own first. */
  stops: { iso: string; text: string }[];
  /** Part suppliers of the bottleneck itself, with their countries. */
  parts: { name: string; isos: string[] }[];
}

const SLUGS = new Set(BOTTLENECKS.map((b) => b.slug));

function linked(slug: string, rel: 'depends on' | 'depended on by'): string[] {
  return neighbors('bottleneck', slug)
    .filter((e) => e.rel === rel && e.to.kind === 'bottleneck' && SLUGS.has(e.to.id))
    .map((e) => e.to.id);
}

/** Maker countries (part suppliers excluded), else the bottleneck's jurisdictions. */
export function whereMade(b: Bottleneck): string[] {
  const makers = b.producers.filter((p) => !p.supplier).flatMap((p) => p.jurisdictions);
  const isos = makers.length > 0 ? makers : b.jurisdictions;
  return [...new Set(isos.map((c) => c.toLowerCase()))];
}

function short(name: string, max = 30): string {
  return name.length <= max ? name : `${name.slice(0, max - 1).trimEnd()}…`;
}

export function chainRoute(chain: Bottleneck): ChainRoute {
  const level = new Map<string, number>([[chain.slug, 0]]);
  const beyond = new Map<string, number>();
  // Breadth first, each way: a step keeps the level it was first reached at.
  for (const [rel, sign] of [
    ['depends on', -1],
    ['depended on by', 1],
  ] as const) {
    let frontier = [chain.slug];
    for (let d = 1; d <= ROUTE_DEPTH + 1; d += 1) {
      const next: string[] = [];
      for (const slug of frontier) {
        for (const n of linked(slug, rel)) {
          if (level.has(n)) continue;
          if (d > ROUTE_DEPTH) {
            beyond.set(slug, (beyond.get(slug) ?? 0) + 1);
            continue;
          }
          level.set(n, sign * d);
          next.push(n);
        }
      }
      frontier = next;
    }
  }

  const steps = [...level.entries()]
    .map(([slug, lv]) => ({ b: bottleneckBySlug(slug)!, lv }))
    .sort((a, b) => a.lv - b.lv || a.b.name.localeCompare(b.b.name))
    .map(({ b, lv }, i) => ({
      slug: b.slug,
      name: b.name,
      level: lv,
      step: i + 1,
      isos: whereMade(b),
      binding: b.binding,
      href: chainHref(b.slug),
      beyond: beyond.get(b.slug) ?? 0,
    }));

  const on = new Set(level.keys());
  const edges: [string, string][] = [];
  for (const slug of on) {
    for (const input of linked(slug, 'depends on')) {
      if (on.has(input) && level.get(input)! < level.get(slug)!) edges.push([input, slug]);
    }
  }

  const bySlug = new Map(steps.map((s) => [s.slug, s]));
  const hops = new Map<string, { from: string; to: string }>();
  const hop = (from: string, to: string) => {
    if (from !== to) hops.set(`${from}>${to}`, { from, to });
  };
  for (const [input, consumer] of edges) {
    const to = bySlug.get(consumer)?.isos[0];
    if (!to) continue;
    for (const from of bySlug.get(input)?.isos.slice(0, COUNTRIES_PER_STEP) ?? []) hop(from, to);
  }
  const parts = chain.producers
    .filter((p) => p.supplier)
    .map((p) => ({ name: p.name, isos: p.jurisdictions.map((c) => c.toLowerCase()) }));
  const home = bySlug.get(chain.slug)?.isos[0];
  if (home) for (const p of parts) for (const iso of p.isos) hop(iso, home);

  // One label per country, keyed to the numbered list: a step's name when it
  // stands alone there, its numbers when several share the country. The
  // bottleneck's own country comes first, so the globe turns to face it.
  const labels = new Map<string, { nums: number[]; name: string; parts: boolean }>();
  const at = (iso: string) => {
    const hit = labels.get(iso) ?? { nums: [], name: '', parts: false };
    labels.set(iso, hit);
    return hit;
  };
  const ordered = [...steps].sort((a, b) => Math.abs(a.level) - Math.abs(b.level));
  for (const s of ordered) {
    if (!s.isos[0]) continue;
    const hit = at(s.isos[0]);
    hit.nums.push(s.step);
    hit.name = s.name;
  }
  for (const p of parts) for (const iso of p.isos) at(iso).parts = true;
  const stops = [...labels.entries()].map(([iso, { nums, name, parts: supplies }]) => ({
    iso,
    text:
      nums.length === 1 && !supplies
        ? `${nums[0]} ${short(name, 32)}`
        : [...nums.sort((a, b) => a - b).map(String), ...(supplies ? ['parts'] : [])].join(' · '),
  }));

  return { steps, edges, hops: [...hops.values()], stops, parts };
}

/** "China, Peru, Indonesia and 4 more" — a step's countries in words. */
export function placesLine(isos: string[], max = 3): string {
  if (isos.length === 0) return 'No country on record';
  const names = isos.slice(0, max).map(countryName);
  return isos.length > max ? `${names.join(', ')} and ${isos.length - max} more` : names.join(', ');
}
