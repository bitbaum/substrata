/**
 * The dossier standard: the fixed boxes every country, company, resource and
 * lab is filled against, and what `full`, `thin` and `empty` mean for each.
 * Design: docs/architecture/2026-10-24-research-systems.md §5.
 *
 * A box's state is a pure function of counted rows (`boxStatus` below), never
 * a flag a person sets. Only `stated` and `corroborated` rows count
 * (COUNTED_GRADES); a curated row with no grade of its own reads as `stated`,
 * a candidate row as `lead`. `derived` and `lead` rows are reported beside the
 * count so a reader sees them, and they never move a box.
 *
 * The boxes themselves live one file per kind under ./boxes, with their
 * thresholds as named constants and a comment saying why each is where it is.
 */
import { COUNTED_GRADES, type BoxStatus, type RelationType } from '@/lib/graph/types';
import type { Facet } from '@/lib/entry/candidate';
import { COMPANY_BOXES } from './boxes/company';
import { COUNTRY_BOXES } from './boxes/country';
import { LAB_BOXES } from './boxes/lab';
import { RESOURCE_BOXES } from './boxes/resource';

export const DOSSIER_KINDS = ['country', 'company', 'resource', 'lab'] as const;
export type DossierKind = (typeof DOSSIER_KINDS)[number];

/** What one box counted, by grade, and in words. */
export interface RowCounts {
  stated: number;
  corroborated: number;
  derived: number;
  lead: number;
  /**
   * When the data itself says how many rows the box should hold (every
   * resource the directory names, every producer row a company has), the box
   * is full only once the counted rows reach it.
   */
  expected?: number;
  /** How many of the one row a full box cannot do without (a licensing law, a controlling stake). */
  core?: number;
  /** What was counted, from which source, in one line. */
  basis: string;
}

export interface Thresholds {
  /** Counted rows at or above this, with `core` met and `expected` reached, read `full`. */
  full: number;
  /** Counted rows at or above this read `thin`; below it, `empty`. */
  thin: number;
  /** When set, a full box also needs this many core rows. */
  core?: number;
}

/** Relations that count towards a box once the relation store is plugged in (./relations.ts). */
export interface RelationQuery {
  types: readonly RelationType[];
  /** `out`: the subject is the relation's `from`; `in`: its `to`. */
  direction: 'out' | 'in';
}

/** Where an answer for this box is written. */
export interface WriteTo {
  /**
   * The `add.ts` facet; `relations` is the graph's candidate file
   * (config/candidates/relations.json); null when no candidate path exists
   * and the box is filled by a person or a regenerating script.
   */
  facet: Facet | 'relations' | null;
  file: string;
  /** The command a model or a person runs. */
  command: string;
}

export interface BoxDefinition {
  id: string;
  kind: DossierKind;
  label: string;
  /** The question the box answers. */
  question: string;
  /** What one counted row is, singular ("facility named with its operator"). */
  unit: string;
  /** The same, plural ("facility rows"). */
  units: string;
  thresholds: Thresholds;
  /** The core row in words, when `thresholds.core` is set. */
  coreNeed?: string;
  /** Source families a reader accepts for this box, best first. */
  allowedSources: readonly string[];
  writeTo: WriteTo;
  /** One worked example of a good row in the `writeTo` shape. Shape only: never copy its quote. */
  example: Record<string, unknown>;
  /** Relations that count here once the relation store is plugged in. */
  relations?: readonly RelationQuery[];
  /** True when nothing in the repository feeds the box yet: it is empty until relations or a new source arrive. */
  noSourceYet?: boolean;
}

/** The rows that move a box: `stated` and `corroborated` only. */
export function countedRows(c: RowCounts): number {
  const byGrade = { stated: c.stated, corroborated: c.corroborated, derived: 0, lead: 0 };
  return COUNTED_GRADES.reduce((n, grade) => n + byGrade[grade], 0);
}

/** The whole rule, in one place: what full, thin and empty mean. */
export function boxStatus(c: RowCounts, t: Thresholds): BoxStatus {
  const n = countedRows(c);
  const coreMet = t.core === undefined || (c.core ?? 0) >= t.core;
  const expectedMet = c.expected === undefined || n >= c.expected;
  if (n >= t.full && coreMet && expectedMet) return 'full';
  if (n >= t.thin) return 'thin';
  return 'empty';
}

/** "full needs 10 facility rows and a licensing law", for the task text and the page. */
export function fullMeans(def: BoxDefinition): string {
  const noun = def.thresholds.full === 1 ? def.unit : def.units;
  const core = def.coreNeed ? `, including ${def.coreNeed}` : '';
  return `at least ${def.thresholds.full} stated ${noun}${core}`;
}

export const DOSSIER_DEFINITIONS: Record<DossierKind, readonly BoxDefinition[]> = {
  country: COUNTRY_BOXES,
  company: COMPANY_BOXES,
  resource: RESOURCE_BOXES,
  lab: LAB_BOXES,
};

export function boxesFor(kind: DossierKind): readonly BoxDefinition[] {
  return DOSSIER_DEFINITIONS[kind];
}

export function boxDefinition(kind: DossierKind, box: string): BoxDefinition | undefined {
  return DOSSIER_DEFINITIONS[kind].find((b) => b.id === box);
}

/**
 * The owner's order of work: the uranium belt first, then the lithium and
 * copper Americas, then the Nordic and Arctic producers. Tasks with equal
 * demand are emitted in this order; every other country follows.
 */
export const PRIORITY_COUNTRIES = [
  'ne',
  'kz',
  'uz',
  'tj',
  'kg',
  'tm',
  'mn',
  'ru',
  'cn',
  'us',
  'ca',
  'br',
  'ar',
  'cl',
  'pe',
  'ec',
  'no',
  'se',
  'fi',
  'is',
] as const;
