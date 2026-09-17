import { allNotes } from '../../notes';
import { noteHref } from '../../links';
import { entityId, type Entity } from '../types';
function articles(): Entity[] {
  return allNotes().map((n) => ({
    id: entityId('article', n.slug),
    kind: 'article' as const,
    key: n.slug,
    name: n.title,
    aka: [],
    href: noteHref(n.slug),
    summary: n.summary,
    evidence: 'editorial',
    sources: [],
    topics: n.tags,
    retrievalText: n.summary,
  }));
}

export const source = { kind: 'article' as const, build: articles };
