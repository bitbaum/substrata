/**
 * Rung 3 of the answer ladder: the relation graph as two chat tools
 * (docs/architecture/2026-10-24-research-systems.md §1, §3).
 *
 * Asked live on 2026-10-24 who owns the Kazakh uranium ventures, the Ask
 * could only paste the USGS cell; "who owns Inkai", "what else does
 * Kazatomprom hold" and "how is Sumitomo connected to Kazakh uranium" had no
 * tool at all, though 1,815 sourced edges sat in lib/graph. These walk them.
 *
 * Every row is a relation WITH its evidence (graph-rows.ts): the quote, the
 * source, the grade in words and whether a number may use it. A lead is
 * listed apart and never counted; a curated row is said "as read from …".
 */
import { resolveIn } from '../entities/registry';
import { findGraphNode, type Prefer } from '../graph/find';
import { printedAs } from '../graph/aliases';
import {
  graphNode,
  relationsFrom,
  relationsTo,
  type Relation,
  type RelationType,
} from '../graph/index';
import { RELATION_TYPES } from '../graph/types';
import { connections } from './graph-paths';
import { nodePage, READING_NOTE, relationRow, rememberNode, type RelationRow } from './graph-rows';
import { num, str, type ChatTool } from './tool';

const MAX_ROWS = 18;

const NOTE = `Each row is one relation with its source. ${READING_NOTE} Give a stake exactly as \`share\`. A row whose grade is "Unverified lead" is never a finding and never counted; "Worked out from other relations" is said as worked out, with its rule. Nothing here names buyers unless a \`supplies\`/\`buys_from\` row says so.`;

const graphIso = (id: string) => graphNode(id).iso2;

function split(rows: { r: Relation; row: RelationRow }[]) {
  const take = (xs: typeof rows) => xs.slice(0, MAX_ROWS).map((x) => x.row);
  const kept = rows.filter((x) => x.r.grade !== 'lead');
  const leads = rows.filter((x) => x.r.grade === 'lead');
  return { rows: take(kept), leads: take(leads), more: Math.max(0, kept.length - MAX_ROWS) };
}

const relationType = (v: unknown): RelationType | undefined =>
  (RELATION_TYPES as readonly string[]).includes(str(v)) ? (str(v) as RelationType) : undefined;

export const GRAPH_TOOLS: ChatTool[] = [
  {
    name: 'related_to',
    description:
      "Who owns, operates or holds stakes in a company or venture, and what it owns or operates — from the relation graph (USGS yearbook tables, ownership filings), each relation with its share, grade and the source quote. Use FIRST for 'who owns X', 'who are X's shareholders', 'which companies does X hold stakes in', 'what does X operate', 'X's partners'. `entity` is a name as typed (e.g. Inkai, Kazatomprom, Cameco). Optional: `type` (owns, operates, …), `direction` (in = who owns/operates it, out = what it owns/operates), `max_hops` 2 to add partners (co-owners of what it holds), `country` to keep one country.",
    parameters: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Company or venture name, e.g. Inkai, Kazatomprom' },
        type: { type: 'string', description: 'owns, operates, supplies, … (omit for all)' },
        direction: { type: 'string', description: 'in, out or both (default both)' },
        max_hops: { type: 'number', description: '1 (default) or 2 for partners' },
        country: { type: 'string', description: 'Keep relations in this country only' },
        prefer: { type: 'string', description: 'owned or owner: which node a vague name means' },
      },
      required: ['entity'],
    },
    label: (a) => `Reading the relations of ${str(a.entity) || 'an entity'}`,
    // Kazatomprom's sixteen ventures, each with its quote, fit whole.
    budget: 9500,
    run: async (a, env) => {
      const prefer = (['owned', 'owner'] as const).find((p) => p === str(a.prefer)) as
        Prefer | undefined;
      const found = findGraphNode(str(a.entity), { prefer });
      if (!found)
        return {
          error: `No company or venture called "${str(a.entity)}" is in the relation graph.`,
          note: 'The graph holds operators and owners from USGS yearbook tables and the ownership rows; a firm none of them names is not in it.',
        };
      const id = found.node.id;
      const type = relationType(a.type);
      const direction = str(a.direction);
      const country = str(a.country) ? resolveIn('country', str(a.country))?.key : undefined;
      const f = type ? { type } : {};
      const inCountry = (r: Relation, other: string) =>
        !country || graphIso(other).includes(country) || graphIso(r.to).includes(country);
      const rows = (rels: Relation[], end: 'from' | 'to') =>
        rels.filter((r) => inCountry(r, r[end])).map((r) => ({ r, row: relationRow(r, id) }));
      const incoming = direction === 'out' ? [] : relationsTo(id, f);
      const outgoing = direction === 'in' ? [] : relationsFrom(id, f);
      const owners = split(
        rows(
          incoming.filter((r) => r.type === 'owns'),
          'from',
        ),
      );
      const operators = split(
        rows(
          incoming.filter((r) => r.type === 'operates'),
          'from',
        ),
      );
      const holds = split(
        rows(
          outgoing.filter((r) => r.type === 'owns'),
          'to',
        ),
      );
      const operates = split(
        rows(
          outgoing.filter((r) => r.type === 'operates'),
          'to',
        ),
      );
      // Who takes its output: what it supplies or ships, and who says they buy from it.
      const sells = (r: Relation, out: boolean) =>
        out ? r.type === 'supplies' || r.type === 'ships_to' : r.type === 'buys_from';
      const buyers = split([
        ...rows(
          outgoing.filter((r) => sells(r, true)),
          'to',
        ),
        ...rows(
          incoming.filter((r) => sells(r, false)),
          'from',
        ),
      ]);
      const plain = (r: Relation, out: boolean) =>
        !['owns', 'operates'].includes(r.type) && !sells(r, out);
      const other = split([
        ...rows(
          incoming.filter((r) => plain(r, false)),
          'from',
        ),
        ...rows(
          outgoing.filter((r) => plain(r, true)),
          'to',
        ),
      ]);
      rememberNode(env, found.node);
      const partners =
        num(a.max_hops, 1, 1, 2) === 2
          ? outgoing
              .filter((r) => r.type === 'owns' || r.type === 'operates')
              .filter((r) => inCountry(r, r.to))
              .flatMap((held) =>
                relationsTo(held.to, { type: 'owns' })
                  .filter((r) => r.from !== id && r.grade !== 'lead')
                  .map((r) => ({
                    through: relationRow(held, id).name,
                    ...relationRow(r, held.to),
                  })),
              )
              .slice(0, MAX_ROWS)
          : undefined;
      const leads = [owners, operators, holds, operates, buyers, other].flatMap((x) => x.leads);
      return {
        entity: {
          name: found.node.name,
          ...(nodePage(found.node) ? { page: nodePage(found.node) } : {}),
          matched_by: found.how,
          ...(printedAs(id).length ? { also_printed_as: printedAs(id) } : {}),
          ...(found.node.inDirectory
            ? {}
            : { note: 'No profile on the site: known only from the relations below.' }),
        },
        ...(found.alsoMatched.length ? { also_matched: found.alsoMatched.map((n) => n.name) } : {}),
        owners: owners.rows,
        operators: operators.rows,
        holds_stakes_in: holds.rows,
        operates: operates.rows,
        ...(buyers.rows.length ? { buyers: buyers.rows } : {}),
        ...(other.rows.length ? { other: other.rows } : {}),
        ...(partners ? { partners } : {}),
        ...(leads.length ? { unverified_leads: leads } : {}),
        ...(holds.more + operates.more + owners.more
          ? { more: `${holds.more + operates.more + owners.more} more relations not shown` }
          : {}),
        counted: `${[owners, operators, holds, operates, buyers, other].flatMap((x) => x.rows).filter((r) => r.counted).length} counted relation(s); leads are never counted`,
        note: NOTE,
      };
    },
  },
  {
    name: 'how_connected',
    description:
      "How two things are connected in the relation graph: the chains of ownership and operation between them, each link with its share, grade and source quote. `a` and `b` are names as typed; `b` may be a country, with `resource` to mean its facilities for that resource (e.g. a = Sumitomo, b = Kazakhstan, resource = uranium). Use for 'how is X connected to Y', 'what links X and Y'.",
    parameters: {
      type: 'object',
      properties: {
        a: { type: 'string', description: 'A company or venture' },
        b: { type: 'string', description: 'Another company, a venture, or a country' },
        resource: { type: 'string', description: 'With a country as b: e.g. uranium' },
        max_hops: { type: 'number', description: '1 to 4 (default 3)' },
      },
      required: ['a', 'b'],
    },
    label: (a) => `Tracing how ${str(a.a) || 'one'} connects to ${str(a.b) || 'another'}`,
    budget: 7000,
    run: async (a, env) => connections(a, env, NOTE),
  },
];
