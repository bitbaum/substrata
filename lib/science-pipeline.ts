/**
 * The pipeline per bottleneck, as pure functions: the hand-written judgements
 * placed on stages, the feed counts laid over them, and the join from an
 * institution a source names to a company in the directory.
 */
import {
  PIPELINE_STAGES,
  stageForReadiness,
  type PipelineStage,
} from '@/config/substrata-pipeline';
import { SCIENCE } from '@/config/substrata-science';
import { SUBSTITUTES, type SubstituteStatus } from '@/config/substrata-substitutes';
import { LISTING_OVERRIDES } from '@/config/substrata-listing-overrides';
import { sameCompany } from './listing-match';
import { listingFor, type Listing } from './listings';
import { MARKET_PARTICIPANTS } from './participants';
import { scienceHref, slugify } from './links';

/** A stage a person placed something on. Established only with a citation; otherwise claimed. */
export interface Judgement {
  stage: PipelineStage;
  name: string;
  basis: string;
  /** The citation behind the placement, or null — then the page says "claimed". */
  source: string | null;
  judgedOn: string;
  href: string | null;
  what: 'technology' | 'substitute';
  readiness: number | null;
}

const SUBSTITUTE_STAGE: Partial<Record<SubstituteStatus, PipelineStage>> = {
  laboratory: 'applied',
  'demonstrated, not qualified': 'pilot',
  'qualified for some uses': 'early',
  'qualified, capacity-limited': 'early',
  'in use': 'scale',
};

export function judgementsFor(bottleneck: string): Judgement[] {
  const slug = slugify(bottleneck);
  const tech: Judgement[] = SCIENCE.filter((s) =>
    s.relieves.some((r) => r.bottleneck === bottleneck),
  ).map((s) => ({
    stage: stageForReadiness(s.readiness),
    name: s.name,
    basis: s.readinessWhy,
    source: s.source,
    judgedOn: s.judgedOn,
    href: scienceHref(s.id),
    what: 'technology',
    readiness: s.readiness,
  }));
  const subs: Judgement[] = SUBSTITUTES.filter((s) => s.material === slug).flatMap((s) => {
    const stage = SUBSTITUTE_STAGE[s.status];
    return stage
      ? [
          {
            stage,
            name: s.candidate,
            basis: `${s.status}. ${s.why}`,
            source: s.sources[0] ?? null,
            judgedOn: s.readOn,
            href: null,
            what: 'substitute' as const,
            readiness: null,
          },
        ]
      : [];
  });
  return [...tech, ...subs];
}

export interface StageCell {
  stage: PipelineStage;
  items: number;
  fresh: number;
  judgements: Judgement[];
}

/** Five cells, always in stage order, so every bottleneck's bar reads the same way. */
export function funnelFor(
  bottleneck: string,
  counts: readonly { bottleneck: string; stage: PipelineStage; items: number; fresh: number }[],
): StageCell[] {
  const judged = judgementsFor(bottleneck);
  return PIPELINE_STAGES.map(({ id }) => {
    const row = counts.find((c) => c.bottleneck === bottleneck && c.stage === id);
    return {
      stage: id,
      items: row?.items ?? 0,
      fresh: row?.fresh ?? 0,
      judgements: judged.filter((j) => j.stage === id),
    };
  });
}

/** The furthest stage with a CITED judgement, or null. Items never advance it past pilot. */
export function furthestEstablished(cells: readonly StageCell[]): PipelineStage | null {
  const cited = cells.filter((c) => c.judgements.some((j) => j.source) || c.items > 0);
  return cited.length > 0 ? cited[cited.length - 1].stage : null;
}

export interface DirectoryMatch {
  /** The name that matched: a directory company's own, or the listed parent it trades through. */
  name: string;
  /** Directory rows behind that name: one company, or every business of a parent. */
  rows: { slug: string; name: string }[];
  listing: Listing | null;
}

/** "ASML (Netherlands)" → "ASML": OpenAlex's disambiguating country is not part of the name. */
export function bareInstitution(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Every name a directory company is known by — its own, or the listed parent
 * it trades through — with the name to show: a business of a parent is shown
 * as the parent, because a paper by "Intel" is not evidence about the foundry.
 */
const KNOWN_AS = (() => {
  const by = new Map<string, { show: string; rows: { slug: string; name: string }[] }>();
  const add = (name: string, show: string, row: { slug: string; name: string }) => {
    const entry = by.get(name) ?? { show, rows: [] };
    if (!entry.rows.some((r) => r.slug === row.slug)) entry.rows.push(row);
    by.set(name, entry);
  };
  for (const p of MARKET_PARTICIPANTS) {
    const row = { slug: p.slug, name: p.name };
    const o = LISTING_OVERRIDES[p.slug];
    if (o && 'parent' in o) add(o.parent, o.parent, row);
    else {
      add(p.name, p.name, row);
      if (o && 'query' in o) add(o.query, p.name, row);
    }
  }
  return [...by.entries()];
})();

/**
 * The directory company an institution is, by the strict rule in
 * lib/listing-match.ts: every distinguishing word on both sides, generic
 * words ("Electronics", "Group") aside.
 */
export function matchDirectory(institution: string): DirectoryMatch | null {
  const bare = bareInstitution(institution);
  const hit = KNOWN_AS.find(([name]) => sameCompany(name, bare));
  if (!hit) return null;
  const [, { show, rows }] = hit;
  return { name: show, rows, listing: listingFor(rows[0].slug) ?? null };
}
