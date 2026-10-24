/**
 * The reviewed aliases (config/entity-aliases.ts), applied: one id per
 * organisation. Only a pair in that table merges; the matcher in
 * ./alias-match.ts proposes, it never applies.
 */
import { ENTITY_ALIASES, type EntityAlias } from '@/config/entity-aliases';
import type { EntityId } from '@/lib/entities/types';
import type { Relation } from './types';
import { relationId } from './validate';

/** Every problem with an alias table: chains, self-pairs, an alias listed twice. */
export function aliasProblems(table: readonly EntityAlias[] = ENTITY_ALIASES): string[] {
  const problems: string[] = [];
  const aliases = new Set(table.map((a) => a.alias));
  const seen = new Set<string>();
  for (const a of table) {
    if (a.alias === a.canonical) problems.push(`${a.alias} is its own alias`);
    if (aliases.has(a.canonical)) problems.push(`${a.canonical} is itself an alias: a chain`);
    if (seen.has(a.alias)) problems.push(`${a.alias} is listed twice`);
    seen.add(a.alias);
    if (a.reason.trim().length < 40) problems.push(`${a.alias}: the reason is not a reason`);
    if (!/^https:\/\//.test(a.source)) problems.push(`${a.alias}: no source`);
  }
  return problems;
}

const problems = aliasProblems();
if (problems.length) throw new Error(`config/entity-aliases.ts: ${problems.join('; ')}`);

const BY_ALIAS = new Map(ENTITY_ALIASES.map((a) => [a.alias as string, a]));

/** The id a node merges into, or the id itself. */
export function canonicalId(id: EntityId): EntityId {
  return BY_ALIAS.get(id)?.canonical ?? id;
}

/** The reviewed entry for an alias id, if it is one. */
export function aliasEntry(id: string): EntityAlias | undefined {
  return BY_ALIAS.get(id);
}

/** Other spellings the sources printed for a canonical id. */
export function printedAs(id: string): string[] {
  return ENTITY_ALIASES.filter((a) => a.canonical === id).map((a) => a.printed);
}

/** A relation with both endpoints moved to their canonical ids, its id recomputed. */
export function withCanonicalEnds(r: Relation): Relation {
  const from = canonicalId(r.from);
  const to = canonicalId(r.to);
  if (from === r.from && to === r.to) return r;
  const moved = { ...r, from, to };
  return { ...moved, id: relationId(moved) };
}
