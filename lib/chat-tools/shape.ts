/** Turning corpus records into short, labelled, linkable tool results. */
import type { Bottleneck } from '../bottlenecks';
import type { MarketParticipant } from '../participants';
import type { CoverageEvent } from '@/config/substrata-events';
import { VERIFICATION_LABEL } from '@/config/substrata-evidence';
import { SCARCITY_LABEL } from '@/config/substrata-participants';
import type { Entity } from '../entities/types';
import { neighbors, GRAPH_KINDS, type GraphKind } from '../graph';
import { slugify } from '../links';
import {
  companiesOn,
  companyEdges,
  dependentsOf,
  inputsOf,
  type Dependency,
} from '../dependencies';
import { remember, type Ledger } from './ledger';

// ---------------------------------------------------------------------------
// Shaping — short, labelled, linkable.
// ---------------------------------------------------------------------------

export const clip = (text: string | null | undefined, n: number) => {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1).trimEnd()}…` : flat;
};

export function eventRow(event: CoverageEvent) {
  return {
    date: event.date,
    headline: event.headline,
    effect: event.effect,
    bottlenecks: event.bottlenecks,
    participants: event.participants,
    source: event.source,
    source_kind: event.primary ? 'primary source' : 'secondary source',
    quote: clip(event.quote, 220),
    status: 'Accepted event (read and committed by an analyst)',
  };
}

/** A dependency row, compact: the other end, which way, and the sentence behind it. */
function edgeRow(d: Dependency, other: string) {
  return {
    name: other,
    relation: d.kind === 'needs' ? 'depends on' : 'sells into',
    source: d.source,
    quote: clip(d.quote, 180),
  };
}

const HORIZON: Record<string, string> = {
  now: 'binding now',
  'two-years': 'binding within two years',
  beyond: 'binding beyond two years',
};

export function bottleneckSummary(b: Bottleneck) {
  return {
    name: b.name,
    page: `/bottlenecks/${b.slug}`,
    binding_score: `${b.binding}/12 (analyst judgement)`,
    horizon: HORIZON[b.horizon] ?? b.horizon,
    row_state: VERIFICATION_LABEL[b.state],
    producers_sourced: `${b.counts.sourced} of ${b.counts.total}`,
  };
}

export function bottleneckDetail(b: Bottleneck, ledger: Ledger) {
  const page = `/bottlenecks/${b.slug}`;
  remember(ledger, {
    title: b.name,
    href: page,
    kind: 'bottleneck',
    evidence: VERIFICATION_LABEL[b.state],
    primary: b.producers.flatMap((p) => (p.source ? [p.source] : [])).slice(0, 4),
  });
  return {
    name: b.name,
    page,
    what_it_is: clip(b.plain, 300),
    why_it_binds: clip(b.why, 500),
    spec: b.spec,
    stage: b.stage,
    technologies: b.technologies,
    jurisdictions: b.jurisdictions,
    assessment: {
      binding_score: `${b.binding}/12`,
      tests: b.score,
      horizon: HORIZON[b.horizon] ?? b.horizon,
      rationale: clip(b.rationale, 400),
      judged_on: b.judgedOn,
      status: 'Analyst judgement, not a sourced fact',
    },
    producers: b.producers.slice(0, 12).map((p) => ({
      name: p.name,
      page: `/markets/${slugify(p.name)}`,
      role: p.role,
      jurisdictions: p.jurisdictions,
      status: VERIFICATION_LABEL[p.verification],
      source: p.source,
      candidate_pages:
        p.verification === 'candidate'
          ? p.candidates.slice(0, 2).map((c) => ({
              url: c.url,
              title: clip(c.title, 90),
              status: 'Search-engine candidate, not checked',
            }))
          : undefined,
    })),
    producer_note:
      'A producer list is corpus coverage, never the whole market. Only "Sourced" rows are findings.',
    recent_events: b.events.slice(0, 5).map(eventRow),
    depends_on: inputsOf(b.name).map((d) => edgeRow(d, d.on)),
    depended_on_by: dependentsOf(b.name).map((d) => edgeRow(d, d.from)),
    companies_on_it: companiesOn(b.name).map((d) => edgeRow(d, d.from)),
  };
}

export function companyDetail(p: MarketParticipant, ledger: Ledger) {
  const page = `/markets/${p.slug}`;
  remember(ledger, {
    title: p.name,
    href: page,
    kind: 'company',
    evidence: p.hasVerifiedRow ? 'has a sourced row' : 'no sourced row yet',
    primary: [p.directorySource, p.existenceVerifiedBy?.url].filter((u): u is string => !!u),
  });
  return {
    name: p.name,
    page,
    layer: p.layer,
    role: p.role,
    jurisdictions: p.jurisdictions,
    scarcity_grade: p.scarcity
      ? `${SCARCITY_LABEL[p.scarcity]} (analyst judgement, not a cited fact)`
      : null,
    why_graded: clip(p.why, 400) || null,
    directory_source: p.directorySource,
    in_graded_directory: p.inDirectory,
    makes: p.produces.map((x) => ({
      bottleneck: x.bottleneck,
      page: `/bottlenecks/${x.slug}`,
      step: x.step,
      status: VERIFICATION_LABEL[x.verification],
      source: x.source,
    })),
    recent_events: p.events.slice(0, 5).map(eventRow),
    rests_on: companyEdges(p.name).map((d) => edgeRow(d, d.on)),
    note: 'Nothing here establishes market share, revenue or rank.',
  };
}

export function entityDetail(e: Entity, ledger: Ledger) {
  remember(ledger, {
    title: e.name,
    href: e.href,
    kind: e.kind,
    evidence: e.evidence,
    primary: e.sources.slice(0, 4),
  });
  const joins = (GRAPH_KINDS as string[]).includes(e.kind)
    ? neighbors(e.kind as GraphKind, e.key)
        .slice(0, 10)
        .map((edge) => ({
          relation: edge.rel,
          name: edge.to.label,
          kind: edge.to.kind,
          page: edge.to.href,
          status: edge.evidence,
        }))
    : [];
  return {
    name: e.name,
    kind: e.kind,
    page: e.href,
    summary: e.summary,
    evidence_state: e.evidence,
    sources: e.sources.slice(0, 5),
    record: clip(e.retrievalText, 1200),
    connected: joins,
  };
}
