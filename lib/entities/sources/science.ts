import { scienceHref } from '../../links';
import { SCIENCE } from '@/config/substrata-science';
import { entityId, type Entity } from '../types';
function science(): Entity[] {
  return SCIENCE.map((s) => ({
    id: entityId('science', s.id),
    kind: 'science' as const,
    key: s.id,
    name: s.name,
    aka: [],
    href: scienceHref(s.id),
    summary: s.plain,
    evidence: s.source ? 'source-backed readiness judgement' : 'unsourced judgement',
    sources: s.source ? [s.source] : [],
    topics: [s.front, ...s.industries],
    retrievalText: `${s.plain} ${s.relieves.map((r) => `${r.bottleneck}: ${r.mechanism}`).join(' ')} Readiness ${s.readiness}/9: ${s.readinessWhy}. Analyst judgement dated ${s.judgedOn}. Next milestone: ${s.nextMilestone ?? 'not specified'}`,
  }));
}

export const source = { kind: 'science' as const, build: science };
