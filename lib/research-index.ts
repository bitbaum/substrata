/** One searchable projection for discovery, visual exploration and AI retrieval.
 * All claims remain owned by the research corpus; this module only joins them.
 *
 * Identity comes from `lib/entities/registry.ts`, which is the one place that
 * decides what exists and what it is called. This file used to build ids and
 * hrefs itself, which meant search could know about a thing the profile pages
 * did not, and vice versa. It is now a thin projection: entity plus the long
 * text used for ranking and retrieval.
 */
import { allEntities } from './entities/registry';
import type { EntityKind } from './entities/types';

export interface ResearchDocument {
  id: string;
  kind: EntityKind;
  title: string;
  href: string;
  text: string;
  sources: string[];
  evidence: string;
  topics: string[];
}

export function researchDocuments(): ResearchDocument[] {
  return allEntities().map((entity) => ({
    id: entity.id,
    kind: entity.kind,
    title: entity.name,
    href: entity.href,
    text: entity.retrievalText,
    sources: entity.sources,
    evidence: entity.evidence,
    topics: entity.topics,
  }));
}

export function searchResearch(documents: ResearchDocument[], query: string): ResearchDocument[] {
  const words = query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return documents;
  return documents
    .map((document) => {
      const title = document.title.toLocaleLowerCase();
      const text = `${title} ${document.text} ${document.topics.join(' ')}`.toLocaleLowerCase();
      return {
        document,
        score: words.every((w) => text.includes(w))
          ? words.reduce((n, w) => n + (title.includes(w) ? 4 : 1), 0)
          : 0,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title))
    .map((x) => x.document);
}
