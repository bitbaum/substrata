import { allLearn } from '../../notes';
import { learnHref } from '../../links';
import { entityId, type Entity } from '../types';
function learn(): Entity[] {
  return allLearn().map((n) => ({
    id: entityId('learn', n.slug),
    kind: 'learn' as const,
    key: n.slug,
    name: n.title,
    aka: [],
    href: learnHref(n.slug),
    summary: n.summary,
    evidence: 'explanation',
    sources: [],
    topics: n.tags,
    retrievalText: n.summary,
  }));
}

export const source = { kind: 'learn' as const, build: learn };
