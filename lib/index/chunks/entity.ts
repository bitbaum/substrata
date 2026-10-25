/**
 * Facet `entity`: every registry entity's retrieval text, split on sentence
 * ends at the chunk limit. This is the facet that guarantees coverage — every
 * entity is in at least one chunk — and the one the planner's hits name.
 */
import { allEntities } from '../../entities/registry';
import { entityWeight } from '../../research-index';
import { chunkId, makeChunk, splitText, type Chunk } from '../chunk';
import { indexEvidence } from './evidence';
import { entitySignificance } from './significance';

export function entityChunks(): Chunk[] {
  return allEntities().flatMap((entity) => {
    const evidence = indexEvidence(entity.evidence) ?? 'unverified';
    const significance = entitySignificance(entity);
    // The name opens the text so a piece cut from the middle still says what it is about.
    const pieces = splitText(entity.retrievalText || entity.summary);
    return (pieces.length ? pieces : [entity.name]).map((text, n) =>
      makeChunk({
        id: chunkId('entity', entity.id, n),
        facet: 'entity',
        kind: entity.kind,
        entityIds: [entity.id],
        title: entity.name,
        text: n === 0 || text.startsWith(entity.name) ? text : `${entity.name}: ${text}`,
        href: entity.href,
        ...(entity.sources[0] ? { sourceUrl: entity.sources[0] } : {}),
        evidence,
        significance,
        ...(entityWeight(entity) ? { weight: entityWeight(entity) } : {}),
      }),
    );
  });
}
