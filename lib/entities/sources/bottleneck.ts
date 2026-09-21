import { BOTTLENECKS } from '../../bottlenecks';
import { bottleneckHref } from '../../links';
import { entityId, type Entity } from '../types';
function bottlenecks(): Entity[] {
  return BOTTLENECKS.map((b) => ({
    id: entityId('bottleneck', b.slug),
    kind: 'bottleneck' as const,
    key: b.slug,
    name: b.name,
    aka: [],
    href: bottleneckHref(b.slug),
    summary: b.plain,
    evidence: b.state,
    sources: [...new Set(b.producers.flatMap((p) => (p.source ? [p.source] : [])))],
    topics: [...b.technologies, b.stage, ...b.industries],
    retrievalText: `A chokepoint on the path to faster technology — one of the bottlenecks this project tracks. Explanation and analyst interpretation (not verified by the producer links): ${b.plain} ${b.why} ${b.rationale} Assessment ${b.binding}/12, judgement dated ${b.judgedOn}. Producer claims, each separately labelled: ${b.producers.map((p) => `${p.name}: ${p.verification}${p.source ? ` for making this material (${p.source})` : ''}`).join('; ')}. Producer pages do not establish total market share or the completeness of this list.`,
  }));
}

export const source = { kind: 'bottleneck' as const, build: bottlenecks };
