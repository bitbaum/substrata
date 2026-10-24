/**
 * The other three questions a coverage row answers, each with its working:
 *
 * - how many of the country's facility rows for the resource have a named
 *   operator (a stated or corroborated `operates` edge);
 * - how many of those operators have a stated owner (an `owns` edge into them);
 * - how much of the national export the stated `ships_to` flows account for.
 *
 * Counted grades only (`COUNTED_GRADES`): a derived or lead relation can be
 * shown beside these numbers and never moves them.
 */
import { graphNode, relationsFrom, relationsTo } from '@/lib/graph/index';
import type { GraphStore } from '@/lib/graph/store';
import { commoditySlug } from '@/lib/graph/id';
import type { CountryFacilities } from '@/lib/resources/producers';
import { distinctRows, rowOperators } from './rows';

export interface Fraction {
  count: number;
  of: number;
}

export interface Attribution {
  /** Printed rows (counted once) with at least one named operator. */
  rowsWithOperator: Fraction;
  /** Distinct named operators with at least one stated owner. */
  operatorsWithOwner: Fraction & { withoutOwner: string[] };
  flows:
    | { status: 'computed'; shipped: number; unit: string; relations: string[] }
    | { status: 'cannot'; reason: string; relations: string[] };
}

function flowsOf(iso2: string, resource: string, s: GraphStore): Attribution['flows'] {
  const country = `country:${iso2}`;
  const word = commoditySlug(resource).replace(/s$/, '');
  const flows = relationsFrom(country, { type: 'ships_to', minGrade: 'stated' }, s).filter((r) =>
    r.volume?.commodity ? commoditySlug(r.volume.commodity).includes(word) : false,
  );
  const ids = flows.map((r) => r.id);
  if (!flows.length)
    return {
      status: 'cannot',
      reason: `no stated ships_to flow of ${resource} from this country is held yet`,
      relations: ids,
    };
  // A national export volume is not in any file the repo holds (no trade
  // table is committed), so the denominator does not exist yet: say so rather
  // than divide by something else.
  return {
    status: 'cannot',
    reason: `${flows.length} stated flow(s) are held, but no national export volume for ${resource} is in our sources to compare them with`,
    relations: ids,
  };
}

export function attribution(
  iso2: string,
  resource: string,
  table: CountryFacilities | null,
  s: GraphStore,
): Attribution {
  const rows = table ? distinctRows(table.rows) : [];
  const read = rows.map((f) => rowOperators(iso2, f, table?.url ?? '', s));
  const operators = [...new Set(read.flatMap((r) => r.operators.map((o) => o.id)))];
  const withoutOwner = operators.filter(
    (id) => relationsTo(id, { type: 'owns', minGrade: 'stated' }, s).length === 0,
  );
  return {
    rowsWithOperator: { count: read.filter((r) => r.operators.length > 0).length, of: rows.length },
    operatorsWithOwner: {
      count: operators.length - withoutOwner.length,
      of: operators.length,
      withoutOwner: withoutOwner.map((id) => graphNode(id, s).name),
    },
    flows: flowsOf(iso2, resource, s),
  };
}
