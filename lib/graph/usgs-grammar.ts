/**
 * Parties in a USGS cell: a name, the brackets after it, and the share it is
 * printed with. A bracket of names with percentages is that party's owners; a
 * short bracket is an abbreviation; a bracket naming one company without a
 * percentage is a parent, which never becomes an edge.
 */
import { looksLikeOrganisation } from './parties';
import {
  ABBREVIATION,
  PAIRS,
  ROLE_GROUP,
  SHARE,
  TRAILING_ROLE,
  Unparsed,
  type Group,
  type Item,
} from './usgs-tokens';

export type Role = 'operator' | 'manager' | 'owner';

export interface Party {
  name: string;
  abbr?: string;
  share?: number;
  role?: Role;
  /** Holders listed with percentages in a bracket after the name. */
  owners: Party[];
  /** A single-company bracket with no percentage: a parent, a group, a former name. Never an edge. */
  parents: Party[];
  /** Why a part of this party could not be read; the party itself is still usable. */
  problem?: string;
}

export function hasTopLevelShare(items: Item[]): boolean {
  return items.some((i) => i.t === 'text' && SHARE.test(i.s));
}

function isAbbreviation(raw: string): boolean {
  const words = raw.trim().split(/\s+/);
  return (
    ABBREVIATION.test(raw.trim()) &&
    words.length <= 3 &&
    !/,/.test(raw) &&
    !looksLikeOrganisation(raw)
  );
}

const CONTINUES_NAME = /^\s*[\p{L}(]/u;
const NOT_A_CONTINUATION = /^\s*(and|through|of|including|which)\b/i;

/**
 * A bracket inside a name is part of the name: "China Nonferrous Metal Mining
 * (Group) Co. Ltd.", "Trigon Mining (Namibia) (Pty) Ltd.". Recognised by what
 * follows it — more of a company name, with a legal form — and folded back
 * into the text so the bracket is not read as a parent or an abbreviation.
 */
function foldNameBrackets(items: Item[]): Item[] {
  const out = [...items];
  for (let changed = true; changed;) {
    changed = false;
    for (let i = out.length - 2; i >= 1; i--) {
      const [prev, group, next] = [out[i - 1], out[i], out[i + 1]];
      if (prev.t !== 'text' || group.t !== 'group' || next.t !== 'text') continue;
      const short =
        !group.raw.includes('%') &&
        !group.items.some((x) => x.t === 'group') &&
        group.raw.trim().split(/\s+/).length <= 3 &&
        !ROLE_GROUP.test(group.raw);
      if (!short || !next.s.trim() || NOT_A_CONTINUATION.test(next.s)) continue;
      if (!CONTINUES_NAME.test(next.s) || !looksLikeOrganisation(next.s)) continue;
      out.splice(i - 1, 3, {
        t: 'text',
        s: `${prev.s}${group.open}${group.raw}${PAIRS[group.open]}${next.s}`,
      });
      changed = true;
      break;
    }
  }
  return out;
}

/** One party from its items: a name, then brackets; text after a bracket is not ours to read. */
export function readParty(raw: Item[], share?: number): Party {
  const items = foldNameBrackets(raw);
  const party: Party = { name: '', owners: [], parents: [], ...(share !== undefined && { share }) };
  let seenGroup = false;
  for (const item of items) {
    if (item.t === 'text') {
      if (!seenGroup) party.name += item.s;
      else if (item.s.replace(/[\s,]/g, '')) {
        const role = item.s.match(/^\s*,?\s*(operator|manager|owner)\s*,?\s*$/i);
        if (role) party.role = role[1].toLowerCase() as Role;
        else throw new Unparsed(`text after a bracket ("${item.s.trim().slice(0, 40)}")`);
      }
      continue;
    }
    seenGroup = true;
    readGroupInto(party, item);
  }
  party.name = party.name.replace(/^\s*(,|and\b)\s*/i, '').trim();
  const role = party.name.match(TRAILING_ROLE);
  if (role) {
    party.role = role[1].toLowerCase() as Role;
    party.name = party.name.replace(TRAILING_ROLE, '');
  }
  party.name = party.name.replace(/[\s,;:]+$/, '').trim();
  return party;
}

function readGroupInto(party: Party, group: Group): void {
  const role = group.raw.match(ROLE_GROUP);
  if (role) {
    party.role = role[1].toLowerCase() as Role;
    return;
  }
  if (hasTopLevelShare(group.items)) {
    party.owners.push(...readList(group.items));
    return;
  }
  if (!party.abbr && isAbbreviation(group.raw) && !group.items.some((i) => i.t === 'group')) {
    party.abbr = group.raw.trim();
    return;
  }
  try {
    const inner = readList(group.items);
    if (inner.length === 1) party.parents.push(inner[0]);
    else party.problem = 'a bracket names several companies without shares';
  } catch (error) {
    if (!(error instanceof Unparsed)) throw error;
    party.problem = error.message;
  }
}

/**
 * A list of parties: split on top-level semicolons, then after each share. What
 * follows a share and is a bracket or a role word still belongs to that holder
 * ("ERG, 100% (private, 60%, …)", "Alcoa of Australia Ltd., 55%, manager").
 */
export function readList(items: Item[]): Party[] {
  const segments: Item[][] = [[]];
  for (const item of items) {
    if (item.t === 'text' && item.s.includes(';')) {
      const parts = item.s.split(';');
      parts.forEach((part, i) => {
        if (i > 0) segments.push([]);
        if (part) segments[segments.length - 1].push({ t: 'text', s: part });
      });
    } else segments[segments.length - 1].push(item);
  }
  return segments.flatMap(readSegment);
}

function readSegment(items: Item[]): Party[] {
  const parties: Party[] = [];
  let current: Item[] = [];
  let last: { items: Item[]; share: number } | null = null;
  const close = () => {
    if (last) parties.push(holderOrProblem(last.items, last.share));
    last = null;
  };
  for (const item of items) {
    if (item.t === 'group') {
      if (last && current.length === 0) last.items.push(item);
      else current.push(item);
      continue;
    }
    let s = item.s;
    while (s) {
      if (last && current.length === 0) {
        const role = s.match(/^\s*,?\s*(manager|operator)\b/i);
        if (role) {
          last.items.push({ t: 'text', s: role[0] });
          s = s.slice(role[0].length);
          continue;
        }
        if (!s.trim()) break;
        const sep = s.match(/^\s*(,\s*)?(and\s+)?/i);
        close();
        s = s.slice(sep ? sep[0].length : 0);
        continue;
      }
      const m = SHARE.exec(s);
      if (!m) {
        current.push({ t: 'text', s });
        break;
      }
      current.push({ t: 'text', s: s.slice(0, m.index) });
      close();
      last = { items: current, share: Number(m[1]) };
      current = [];
      s = s.slice(m.index + m[0].length);
    }
  }
  close();
  const rest = current;
  if (rest.some((i) => i.t === 'group' || i.s.replace(/[\s,]/g, ''))) {
    if (parties.length) {
      // Text after the last share is a holder without one ("…, and Uranium One Netherlands B.V. PLLC").
      parties.push({ ...holderOrProblem(rest), problem: 'no percentage' });
    } else {
      // No share anywhere: one party, or several joined by ", and " each carrying a role.
      const pieces = splitOnAnd(rest);
      const read = pieces.map((p) => readParty(p));
      if (read.length > 1 && !read.every((p) => p.role))
        throw new Unparsed('several companies without shares or roles');
      parties.push(...read);
    }
  }
  return parties;
}

/** A holder in a list: a reading problem stays with that holder instead of failing the row. */
function holderOrProblem(items: Item[], share?: number): Party {
  try {
    return readParty(items, share);
  } catch (error) {
    if (!(error instanceof Unparsed)) throw error;
    return { name: '', owners: [], parents: [], share, problem: error.message };
  }
}

function splitOnAnd(items: Item[]): Item[][] {
  const out: Item[][] = [[]];
  for (const item of items) {
    if (item.t === 'text' && /,\s+and\s+/i.test(item.s)) {
      const parts = item.s.split(/,\s+and\s+/i);
      parts.forEach((part, i) => {
        if (i > 0) out.push([]);
        if (part.trim()) out[out.length - 1].push({ t: 'text', s: part });
      });
    } else out[out.length - 1].push(item);
  }
  return out.filter((p) => p.length);
}
