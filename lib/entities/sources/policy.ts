import { policyHref } from '../../links';
import { INSTRUMENTS } from '@/config/substrata-policy';
import { entityId, type Entity } from '../types';
function policy(): Entity[] {
  return INSTRUMENTS.map((i) => ({
    id: entityId('policy', i.id),
    kind: 'policy' as const,
    key: i.id,
    name: i.title,
    aka: [],
    href: policyHref(i.jurisdiction),
    summary: i.summary,
    evidence: i.primary ? 'primary source' : 'secondary source',
    sources: [i.source],
    topics: [...i.technologies, ...i.industries, i.jurisdiction],
    retrievalText: `${i.summary} ${i.body}. Status: ${i.status}; instrument date: ${i.date}; read on ${i.readOn}. ${i.statusNote ?? ''}`,
  }));
}

export const source = { kind: 'policy' as const, build: policy };
