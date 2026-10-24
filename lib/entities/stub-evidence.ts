/**
 * What a stub company's page prints, arranged: its relations grouped by what
 * they say ("Owns a stake in", "Operated by"), one line each, and every source
 * cell once — a USGS table cell that names sixteen ventures backs sixteen
 * relations, and printing it under each of them made one page five thousand
 * pixels tall. Pure and synchronous: the page renders it, the test reads it.
 */
import { graphNode, relationEvidence, type Relation } from '@/lib/graph/index';
import { countryHref } from '@/lib/world/pages';
import { resolveEntity } from './registry';
import { sourceLabel, stubRelations } from './sources/company-stubs';

/** One source cell: a URL, where in it, and the text, shown once however many rows rest on it. */
export interface SourceCell {
  /** Stable within the page: `s1`, `s2` … in first-use order. */
  id: string;
  url: string;
  /** "the USGS Minerals Yearbook 2023 (Kazakhstan), Table 2. Structure of the mineral industry". */
  label: string;
  locator?: string;
  /** Whole, never cut: the page collapses it instead. */
  quote: string;
  reading: string;
  rows: number;
}

export interface StubRow {
  relationId: string;
  other: { name: string; href?: string };
  /** "50%", or a volume with its period, only when the source states one. */
  amount?: string;
  asOf: string;
  grade: string;
  /** The cells this row rests on, by id. */
  cells: string[];
}

export interface StubGroup {
  key: string;
  label: string;
  rows: StubRow[];
}

const GROUP_LABEL: Partial<Record<Relation['type'], { out: string; in: string }>> = {
  owns: { out: 'Owns a stake in', in: 'Owned by' },
  operates: { out: 'Operates', in: 'Operated by' },
  finances: { out: 'Finances', in: 'Financed by' },
  supplies: { out: 'Supplies', in: 'Supplied by' },
  buys_from: { out: 'Buys from', in: 'Sells to' },
  ships_to: { out: 'Ships to', in: 'Receives from' },
};

const GRADE_SHORT: Record<string, string> = {
  stated: 'stated',
  corroborated: 'two sources',
  derived: 'worked out',
  lead: 'lead',
};

/** Where a reader can open the other end: its page, else the country whose table printed it. */
function otherEnd(id: string): StubRow['other'] {
  const node = graphNode(id);
  const page = resolveEntity(id)?.href ?? (node.iso2[0] ? countryHref(node.iso2[0]) : undefined);
  return { name: node.name, ...(page ? { href: page } : {}) };
}

/** The table a locator names, without the place list after it. */
function tableOf(locator: string | undefined): string | undefined {
  return locator?.split('; ')[0]?.replace(/\s*\(Table \d+\)$/, '');
}

export function stubEvidence(
  id: string,
  relations: Relation[] = stubRelations(id),
): { groups: StubGroup[]; cells: SourceCell[] } {
  const cells = new Map<string, SourceCell>();
  const groups = new Map<string, StubGroup>();
  for (const r of relations) {
    const printed = relationEvidence(r);
    const out = r.from === id;
    const key = `${r.type}:${out ? 'out' : 'in'}`;
    const words = GROUP_LABEL[r.type];
    const label = words ? (out ? words.out : words.in) : printed.sentence.split(' ')[1];
    const group = groups.get(key) ?? groups.set(key, { key, label, rows: [] }).get(key)!;
    const cellIds = r.evidence.map((e, i) => {
      const at = `${e.source}\u0000${e.locator ?? ''}\u0000${e.quote}`;
      let cell = cells.get(at);
      if (!cell) {
        const table = tableOf(e.locator);
        cell = {
          id: `s${cells.size + 1}`,
          url: e.source,
          label: `${sourceLabel(e.source)}${table ? `, ${table}` : ''}`,
          ...(e.locator ? { locator: e.locator } : {}),
          quote: e.quote,
          reading: printed.sources[i]?.reading ?? '',
          rows: 0,
        };
        cells.set(at, cell);
      }
      cell.rows += 1;
      return cell.id;
    });
    group.rows.push({
      relationId: r.id,
      other: otherEnd(out ? r.to : r.from),
      ...(r.share
        ? { amount: `${r.share.value}%` }
        : r.volume
          ? {
              amount: `${r.volume.value.toLocaleString('en')} ${r.volume.unit}${r.volume.commodity ? ` of ${r.volume.commodity}` : ''}, ${r.volume.period}`,
            }
          : {}),
      asOf: r.asOf,
      grade: GRADE_SHORT[r.grade] ?? r.grade,
      cells: cellIds,
    });
  }
  return { groups: [...groups.values()], cells: [...cells.values()] };
}
