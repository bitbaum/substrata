/**
 * How a company does business, from the relation graph (lib/graph): who buys
 * from it, who it buys from, who it competes with, the stakes it holds and the
 * sites it runs. Every row has one anatomy; a group with no rows says which
 * documents would fill it (the dossier's allowed sources) instead of
 * disappearing. Who owns IT is the ownership section, not a group here.
 */
import { COMPANY_BOXES } from '@/lib/dossier/boxes/company';
import { resolveEntity } from '@/lib/entities/registry';
import { hostOf } from '@/lib/desk';
import { neighbours, type Neighbour, type RelationType } from '@/lib/graph/index';
import { countryHref } from '@/lib/world/pages';

export interface BusinessRow {
  id: string;
  name: string;
  href?: string;
  /** What the relation says, from this company's side: "buys from", "operates". */
  relation: string;
  /** "60%", "1,200 t of uranium, 2024": only when the source states one. */
  amount?: string;
  grade: string;
  asOf: string;
  source?: { url: string; label: string };
}

export interface BusinessGroup {
  id: 'customers' | 'suppliers' | 'competitors' | 'stakes' | 'sites' | 'partners';
  label: string;
  rows: BusinessRow[];
  /** When empty: what is missing and which documents would fill it. */
  empty?: { missing: string; sources: readonly string[] };
  /** Where the page already quotes something close (a filing naming its foundries). */
  seeAlso?: { href: string; label: string };
}

type Match = (n: Neighbour) => boolean;
const is =
  (types: RelationType[], dir: 'out' | 'in'): Match =>
  (n) =>
    types.includes(n.relation.type) && n.direction === dir;
const any =
  (...m: Match[]): Match =>
  (n) =>
    m.some((f) => f(n));

const COMPETITION_SOURCES = [
  '10-K Item 1 “Competition”, or a 20-F “Competitive landscape” section',
  'an agency or market report naming the producers of one product',
] as const;

const GROUPS: {
  id: BusinessGroup['id'];
  label: string;
  match: Match;
  always: boolean;
  verb: (n: Neighbour) => string;
  sources?: readonly string[];
}[] = [
  {
    id: 'customers',
    label: 'Customers — who buys from it',
    match: any(is(['supplies', 'ships_to'], 'out'), is(['buys_from'], 'in')),
    always: true,
    verb: (n) => (n.relation.type === 'ships_to' ? 'ships to' : 'sells to'),
    sources: COMPANY_BOXES.find((b) => b.id === 'customers')?.allowedSources,
  },
  {
    id: 'suppliers',
    label: 'Suppliers — who it buys from',
    match: any(is(['buys_from'], 'out'), is(['supplies', 'ships_to'], 'in')),
    always: true,
    verb: () => 'buys from',
    sources: COMPANY_BOXES.find((b) => b.id === 'suppliers')?.allowedSources,
  },
  {
    id: 'competitors',
    label: 'Competitors',
    match: (n) => n.relation.type === 'competes_with',
    always: true,
    verb: () => 'competes with',
    sources: COMPETITION_SOURCES,
  },
  {
    id: 'stakes',
    label: 'Stakes it holds',
    match: is(['owns'], 'out'),
    always: false,
    verb: () => 'owns',
  },
  {
    id: 'sites',
    label: 'Sites it operates',
    match: is(['operates'], 'out'),
    always: false,
    verb: () => 'operates',
  },
  {
    id: 'partners',
    label: 'Partners, licences and finance',
    match: any(
      is(['licenses', 'finances', 'researches'], 'out'),
      is(['licenses', 'finances'], 'in'),
    ),
    always: false,
    verb: (n) =>
      `${n.relation.type === 'finances' ? 'finances' : n.relation.type === 'licenses' ? 'licenses' : 'researches with'}${n.direction === 'in' ? ' (from them)' : ''}`,
  },
];

const GRADE: Record<string, string> = {
  stated: 'stated',
  corroborated: 'two sources',
  derived: 'worked out',
  lead: 'lead, unverified',
};

function row(n: Neighbour, verb: string): BusinessRow {
  const r = n.relation;
  const page =
    resolveEntity(n.node.id)?.href ?? (n.node.iso2[0] ? countryHref(n.node.iso2[0]) : undefined);
  const first = r.evidence[0];
  return {
    id: r.id,
    name: n.node.name,
    ...(page ? { href: page } : {}),
    relation: verb,
    ...(r.share
      ? { amount: `${r.share.value}%` }
      : r.volume
        ? {
            amount: `${r.volume.value.toLocaleString('en')} ${r.volume.unit}${r.volume.commodity ? ` of ${r.volume.commodity}` : ''}, ${r.volume.period}`,
          }
        : {}),
    grade: GRADE[r.grade] ?? r.grade,
    asOf: r.asOf,
    ...(first ? { source: { url: first.source, label: hostOf(first.source) } } : {}),
  };
}

const NOUN: Record<BusinessGroup['id'], string> = {
  customers: 'customer',
  suppliers: 'supplier',
  competitors: 'competitor',
  stakes: 'stake',
  sites: 'site',
  partners: 'partner',
};

/**
 * The groups for an entity id (`company:<slug>`), from the given relations or
 * the graph. `quoted` says which groups the page's dependency rows already
 * speak to (a filing sentence naming its foundries is about suppliers, but
 * names a step of the chain, not a company-to-company relation): an empty
 * group then points there instead of reading as if nothing were known.
 */
export function businessGroups(
  id: string,
  name: string,
  rel: Neighbour[] = neighbours(id),
  quoted: { suppliers?: boolean; customers?: boolean } = {},
): BusinessGroup[] {
  return GROUPS.flatMap((g) => {
    const rows = rel.filter(g.match).map((n) => row(n, g.verb(n)));
    if (rows.length) return [{ id: g.id, label: g.label, rows }];
    if (!g.always) return [];
    return [
      {
        id: g.id,
        label: g.label,
        rows: [],
        empty: {
          missing: `No ${NOUN[g.id]} of ${name} is recorded as a named company with a source yet.`,
          sources: g.sources ?? [],
        },
        ...((g.id === 'suppliers' && quoted.suppliers) || (g.id === 'customers' && quoted.customers)
          ? {
              seeAlso: {
                href: '#dependencies',
                label:
                  g.id === 'suppliers'
                    ? 'What it depends on, quoted from its filings'
                    : 'What it sells into, quoted from its filings',
              },
            }
          : {}),
      },
    ];
  });
}

/** Who owns it, as the relation graph states it: for a company with no listing to read filings for. */
export function ownerRows(id: string, rel: Neighbour[] = neighbours(id)): BusinessRow[] {
  return rel.filter(is(['owns'], 'in')).map((n) => row(n, 'owned by'));
}
