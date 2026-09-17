import { JOIN } from '@/config/substrata-join';
import { entityId, type Entity } from '../types';
function talent(): Entity[] {
  return JOIN.roles.map((r, i) => ({
    id: entityId('talent', String(i)),
    kind: 'talent' as const,
    key: String(i),
    name: r.title,
    aka: [],
    href: '/talent',
    summary: r.what,
    evidence: 'project research need',
    sources: [],
    topics: ['talent'],
    retrievalText: `Research contribution opportunity, not employment. ${r.what} ${r.why}`,
  }));
}

export const source = { kind: 'talent' as const, build: talent };
