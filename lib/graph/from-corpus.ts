/**
 * Relations the corpus already states, read off the rows that state them.
 *
 * Only a row that already carries its source and the text that makes the
 * claim becomes an edge:
 *
 * - an ownership holder (config/substrata-ownership.ts) → `owns` the company.
 *   A holder with a share a person read off the document is `stated`; a holder
 *   named without one (`share: null`) is a `lead`, exactly as the profile page
 *   already renders it. The quote is the row as the person recorded it —
 *   marked `curated-record`, never passed off as the document's words.
 * - a facility with an operator (config/substrata-facilities.ts) → the
 *   operator `operates` it, quoting the row's own line about the source.
 *
 * Two kinds of row do not become edges, and the build report says so: market
 * participants' producer rows name a material, not a counterparty, and carry a
 * source with no quote; and events each name one participant, so no event
 * states a relation between two.
 */
import { FACILITIES } from '@/config/substrata-facilities';
import { OWNERSHIP, type Holder } from '@/config/substrata-ownership';
import { resolveInDirectory } from '@/lib/entities/registry';
import { entityId, type EntityId } from '@/lib/entities/types';
import { holderVerdict } from './holder-kind';
import { resolveParty } from './parties';
import type { Relation, RelationEvidence } from './types';
import { relationId } from './validate';

/**
 * The day the hand-written holder rows were read, where a row does not say:
 * every one of them was committed on this day (git log of the file), so its
 * document was read no later.
 */
export const HAND_HOLDERS_READ_BY = '2026-10-23';

export interface CorpusEdges {
  relations: Relation[];
  /** Minted endpoints, by id, with the name the row printed. */
  names: Record<string, string>;
  /** Rows that made no edge, by reason. */
  skipped: Record<string, number>;
}

function holderQuote(h: Holder): string {
  const share = h.share === null ? 'no share on record' : `${h.share}%`;
  return `${h.name} — ${share}${h.note ? `. ${h.note}` : ''}`;
}

export function corpusRelations(): CorpusEdges {
  const relations: Relation[] = [];
  const names: Record<string, string> = {};
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  const push = (r: Omit<Relation, 'id'>) => relations.push({ ...r, id: relationId(r) });

  for (const row of OWNERSHIP) {
    const company: EntityId = entityId('company', row.company);
    for (const h of row.holders) {
      // A person or a group of holders is never minted as a company (./holder-kind.ts).
      const verdict = holderVerdict(h);
      if (!verdict.party) {
        skip(`holder is ${verdict.reason}`);
        continue;
      }
      const party = resolveParty(h.name);
      if ('skip' in party) {
        skip(`holder is ${party.skip}`);
        continue;
      }
      if (party.minted) names[party.id] = party.name ?? h.name;
      const evidence: RelationEvidence = {
        source: h.source,
        quote: holderQuote(h),
        readOn: h.readOn ?? HAND_HOLDERS_READ_BY,
        reading: 'curated-record',
      };
      push({
        from: party.id,
        to: company,
        type: 'owns',
        grade: h.share === null ? 'lead' : 'stated',
        ...(h.share !== null && { share: { value: h.share, unit: 'percent' as const } }),
        asOf: h.asOf,
        evidence: [evidence],
        origin: h.evidence === 'candidate' ? 'candidate' : 'curated',
      });
    }
  }

  for (const f of FACILITIES) {
    if (!f.operator) {
      skip('facility without an operator on record');
      continue;
    }
    const operator = resolveInDirectory('company', f.operator);
    if (!operator) {
      skip('facility operator not in the directory');
      continue;
    }
    push({
      from: operator.id,
      to: entityId('facility', f.id),
      type: 'operates',
      grade: 'stated',
      asOf: f.readOn,
      evidence: [{ source: f.source, quote: f.what, readOn: f.readOn, reading: 'curated-record' }],
      origin: f.evidence === 'candidate' ? 'candidate' : 'curated',
    });
  }

  return { relations, names, skipped };
}
