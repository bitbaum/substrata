/**
 * Facet `relation`: who operates and who owns a thing, one chunk per thing.
 *
 * The edges arriving at one endpoint — a USGS facility, an operating company,
 * a listed firm's holders — are grouped into one record, because that is the
 * unit a question asks about ("who mines uranium in Kazakhstan, and who owns
 * them"). Grouped again by evidence, so a chunk never mixes a lead with a
 * stated edge: a reader of the chunk knows which it is from its label alone.
 * Endpoints without a directory entity are named in the text and left out of
 * `entityIds`, which only ever holds entities that exist.
 *
 * Significance is kept low on purpose: there are far more relation chunks than
 * entities, each short and dense with names, and a question about a country
 * should reach the country's own record first and its facilities after.
 */
import { graphNode, graphStore, relationEvidence, type Relation } from '../../graph/index';
import { resolveEntity } from '../../entities/registry';
import { chunkId, makeChunk, splitText, type Chunk, type IndexEvidence } from '../chunk';
import { countryId, countryName, uniqueIds } from './ids';

function evidenceOf(r: Relation): IndexEvidence {
  if (r.origin === 'candidate') return 'candidate';
  if (r.grade === 'lead') return 'unverified';
  if (r.grade === 'derived') return 'computed';
  return 'sourced';
}

function phrase(r: Relation): string {
  const printed = relationEvidence(r);
  const where = printed.sources[0];
  return `${printed.sentence} (as of ${r.asOf}; ${printed.gradeLabel.toLowerCase()}${where?.locator ? `; ${where.locator.split(';')[0]}` : ''})`;
}

export function relationChunks(): Chunk[] {
  const store = graphStore();
  const groups = new Map<string, Relation[]>();
  for (const r of store.all) {
    const key = `${r.to}/${evidenceOf(r)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const chunks: Chunk[] = [];
  for (const [key, rows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const target = graphNode(rows[0].to, store);
    const evidence = evidenceOf(rows[0]);
    const countries = uniqueIds(
      target.iso2,
      ...rows.map((r) => graphNode(r.from, store).iso2.slice(0, 1)),
    );
    const place = target.iso2.length ? ` in ${target.iso2.map(countryName).join(', ')}` : '';
    const lists = target.commodities?.length
      ? ` USGS lists it for: ${target.commodities.join(', ')}.`
      : '';
    const what =
      target.kind === 'facility' ? `the facility at ${target.name}${place}` : target.name;
    const text = `Who operates and owns ${what}.${lists} ${rows.map(phrase).join('. ')}.`;
    const linked = [rows[0].to, ...rows.map((r) => r.from)].map(resolveEntity).find(Boolean);
    const href = linked?.href ?? (countries[0] ? `/world/${countries[0]}` : '/research');
    const counted = evidence === 'sourced' || evidence === 'candidate';
    const asOf = rows
      .map((r) => r.asOf)
      .sort()
      .at(-1);
    splitText(text).forEach((piece, n) =>
      chunks.push(
        makeChunk({
          id: chunkId('relation', key, n),
          facet: 'relation',
          kind: target.kind,
          entityIds: uniqueIds(
            [rows[0].to, ...rows.map((r) => r.from)].filter((id) => resolveEntity(id)),
            ...countries.map(countryId),
          ),
          title: `Who operates and owns ${target.name}`,
          text: piece,
          href,
          sourceUrl: rows[0].evidence[0]?.source,
          evidence,
          ...(asOf ? { asOf } : {}),
          significance: counted ? 0.05 : 0.02,
        }),
      ),
    );
  }
  return chunks;
}
