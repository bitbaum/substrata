/**
 * The USGS Minerals Yearbook "Structure of the mineral industry" tables, read
 * as relations.
 *
 * Each facility row in `research/usgs-producers.json` carries one cell naming
 * "major operating companies and major equity owners", in USGS's own
 * shorthand:
 *
 *   Aluminium of Kazakhstan JSC [Eurasian Resources Group (ERG), 100% (private, 60%, and Government, 40%)]
 *   Antofagasta Plc, 70%, and Marubeni Corp., 30%
 *   Gove open pit bauxite mine [Pacific Aluminium Pty. Ltd. (Rio Tinto Ltd., 100%)]
 *   Strong Built Mining Development Corp. (owner), and MacArthur Iron Sand Projects Corp. (operator)
 *
 * The reading, and nothing beyond it:
 * - a single company at the head of the cell `operates` the facility;
 * - a bracket holding names with percentages lists who `owns` the name before
 *   it, each with the share printed; a name without a percentage gets no edge;
 * - a cell that is itself a list of names with percentages lists who `owns`
 *   the facility; one marked "operator" or "manager" also `operates` it;
 * - a facility name at the head ("Gove … mine [Company (…)]") hands the
 *   operator role to the one company in its bracket;
 * - "Government" is the government of the country whose chapter printed it.
 *
 * Anything else is left unparsed with a reason, and the reasons are the
 * report: a bracket that never closes (the cell was cut off), "of which" and
 * "including" lists, two companies run together without a share, a head that
 * is neither recognisably a company nor a facility, a holding "through" an
 * intermediary. An unparsed string produces no edge at all.
 *
 * Pure: the caller passes the file in; `scripts/research/build-usgs-relations.ts`
 * writes the result to `research/usgs-relations.json`.
 */
import type { EntityId } from '@/lib/entities/types';
import { siteId } from '@/lib/resources/sites';
import { looksLikeOrganisation, resolveParty } from './parties';
import type { Relation, RelationType } from './types';
import { checkName, holderProblem, readCell } from './usgs-cell';
import type { Party } from './usgs-grammar';
import { Unparsed } from './usgs-tokens';
import { relationId } from './validate';

export { readCell, type CellShape } from './usgs-cell';
export { Unparsed } from './usgs-tokens';

// =====================================================================
// THE INPUT
// =====================================================================

export interface UsgsFacilityRow {
  resource: string;
  group: string;
  commodity: string;
  companies: string;
  location: string;
  capacity: string;
  unit: string;
}

export interface UsgsChapter {
  iso2: string;
  slug: string;
  year: string;
  url: string;
  pdf: string;
  table: string;
  unit: string;
  facilities: UsgsFacilityRow[];
}

export interface UsgsProducersFile {
  source: string;
  retrieved: string;
  countries: UsgsChapter[];
}

// =====================================================================
// THE ROW AS RELATIONS
// =====================================================================

export interface UsgsNode {
  name: string;
  kind: 'company' | 'facility';
  /** The chapter(s) it was printed in. */
  iso2: string[];
  /** For a facility: what USGS lists there. */
  commodities?: string[];
}

export interface UsgsBuild {
  relations: Relation[];
  nodes: Record<string, UsgsNode>;
  report: UsgsReport;
}

export interface UsgsReport {
  rows: number;
  rowsWithEdges: number;
  rowsUnparsed: number;
  edges: Record<string, number>;
  /** Parts of parsed rows that made no edge, by reason. */
  skipped: Record<string, number>;
  /** Distinct strings left unparsed, with the reason and how many rows printed them. */
  unparsed: { iso2: string; cell: string; reason: string; rows: number }[];
  /** The same relation read with two different shares; neither is kept. */
  conflicts: string[];
}

const GENERIC_PLACE = /^(|na|n\/a|various|.*\bmultiple\b.*)$/i;

/** A facility as an endpoint: one printed place in one country, the same id the site map uses. */
export function usgsFacilityId(iso2: string, location: string): EntityId | null {
  const place = location.replace(/\s+/g, ' ').trim();
  if (GENERIC_PLACE.test(place)) return null;
  return `facility:usgs-${siteId(iso2, location)}`;
}

function facilityLabel(location: string): string {
  const flat = location.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 119)}…` : flat;
}

/** Every relation the file supports, with the nodes they name and what was left unread. */
export function buildUsgsRelations(file: UsgsProducersFile): UsgsBuild {
  const relations = new Map<string, Relation>();
  const conflicts = new Set<string>();
  const nodes: Record<string, UsgsNode> = {};
  const skipped: Record<string, number> = {};
  const unparsed = new Map<string, UsgsReport['unparsed'][number]>();
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  let rows = 0;
  let rowsWithEdges = 0;
  let rowsUnparsed = 0;

  for (const chapter of file.countries) {
    for (const row of chapter.facilities) {
      rows += 1;
      const before = relations.size;
      const evidence = {
        source: chapter.url,
        quote: row.companies.replace(/\s+/g, ' ').trim(),
        readOn: file.retrieved,
        locator: `${chapter.table}; ${row.commodity || row.group}; ${facilityLabel(row.location) || 'no location printed'}`,
        reading: 'table-cell' as const,
      };
      const note = (id: EntityId, name: string, kind: UsgsNode['kind']) => {
        const node = (nodes[id] ??= { name, kind, iso2: [] });
        if (!node.iso2.includes(chapter.iso2)) node.iso2.push(chapter.iso2);
        if (kind === 'facility') {
          node.commodities ??= [];
          const what = row.commodity || row.group;
          if (what && !node.commodities.includes(what)) node.commodities.push(what);
        }
      };
      const add = (type: RelationType, from: EntityId, to: EntityId, share?: number) => {
        if (from === to) return skip('a company listed as its own owner');
        const r: Relation = {
          id: '',
          from,
          to,
          type,
          grade: 'stated',
          ...(share !== undefined && { share: { value: share, unit: 'percent' as const } }),
          asOf: chapter.year,
          evidence: [evidence],
          origin: 'research',
        };
        r.id = relationId(r);
        const seen = relations.get(r.id);
        if (!seen) relations.set(r.id, r);
        else if (seen.share?.value !== r.share?.value) conflicts.add(r.id);
      };
      const party = (p: Party): EntityId | null => {
        const resolved = resolveParty(p.name, { iso2: chapter.iso2, abbr: p.abbr });
        if ('skip' in resolved) {
          skip(`holder is ${resolved.skip}`);
          return null;
        }
        if (resolved.minted) note(resolved.id, p.name, 'company');
        return resolved.id;
      };
      const owners = (target: EntityId, holders: Party[]) => {
        for (const h of holders) {
          const problem = holderProblem(h);
          if (problem) {
            skip(`holder: ${problem}`);
            continue;
          }
          const id = party(h);
          if (!id) continue;
          add('owns', id, target, h.share);
          owners(id, h.owners);
        }
      };
      const parentsOf = (p: Party) => {
        // A parent printed without a percentage is never an edge, but its own owners may be.
        for (const parent of p.parents) {
          skip('parent without a percentage');
          if (parent.owners.length && looksLikeOrganisation(parent.name)) {
            const id = party(parent);
            if (id) owners(id, parent.owners);
          }
        }
        if (p.problem) skip(p.problem);
      };

      const facility = usgsFacilityId(chapter.iso2, row.location);
      if (facility) note(facility, facilityLabel(row.location), 'facility');
      const operate = (p: Party) => {
        const id = party(p);
        if (!id) return null;
        if (facility) add('operates', id, facility);
        else skip('no place printed: operator edge not made');
        return id;
      };

      try {
        const shape = readCell(row.companies);
        if (shape.kind === 'operator' || shape.kind === 'operators') {
          const list = shape.kind === 'operator' ? [shape.operator] : shape.operators;
          for (const op of list) {
            if (shape.kind === 'operators' && !looksLikeOrganisation(op.name)) {
              skip('operator is not recognisably a company');
              continue;
            }
            const id = operate(op);
            if (id) owners(id, op.owners);
            parentsOf(op);
          }
        } else if (shape.kind === 'holders') {
          for (const h of shape.holders) {
            const problem = holderProblem(h);
            if (problem) {
              skip(`holder: ${problem}`);
              continue;
            }
            const id = party(h);
            if (!id) continue;
            if (facility) add('owns', id, facility, h.share);
            else skip('no place printed: facility holder edge not made');
            if (h.role === 'operator' || h.role === 'manager') {
              if (facility) add('operates', id, facility);
            }
            owners(id, h.owners);
            parentsOf(h);
          }
        } else {
          for (const p of shape.parties) {
            checkName(p.name);
            const id = party(p);
            if (!id) continue;
            if (!facility) skip('no place printed: role edge not made');
            else if (p.role === 'owner') add('owns', id, facility);
            else add('operates', id, facility);
          }
        }
      } catch (error) {
        if (!(error instanceof Unparsed)) throw error;
        rowsUnparsed += 1;
        const key = `${chapter.iso2}|${row.companies}`;
        const seen = unparsed.get(key);
        if (seen) seen.rows += 1;
        else
          unparsed.set(key, {
            iso2: chapter.iso2,
            cell: row.companies,
            reason: error.message,
            rows: 1,
          });
        continue;
      }
      if (relations.size > before) rowsWithEdges += 1;
    }
  }

  for (const id of conflicts) relations.delete(id);
  const list = [...relations.values()].sort((a, b) => a.id.localeCompare(b.id));
  const edges: Record<string, number> = {};
  for (const r of list) edges[r.type] = (edges[r.type] ?? 0) + 1;
  const used = new Set(list.flatMap((r) => [r.from, r.to]));
  const kept = Object.fromEntries(
    Object.entries(nodes)
      .filter(([id]) => used.has(id as EntityId))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    relations: list,
    nodes: kept,
    report: {
      rows,
      rowsWithEdges,
      rowsUnparsed,
      edges,
      skipped: Object.fromEntries(Object.entries(skipped).sort(([a], [b]) => a.localeCompare(b))),
      unparsed: [...unparsed.values()],
      conflicts: [...conflicts].sort(),
    },
  };
}
