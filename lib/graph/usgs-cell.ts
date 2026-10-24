/**
 * A whole USGS cell read as one of four shapes — an operator, a list of
 * holders, parties marked operator or owner, or a `Companies:` list — or
 * refused with the reason. The rules are stated in ./usgs-operators.ts.
 */
import { looksLikeOrganisation } from './parties';
import { readList, readParty, type Party } from './usgs-grammar';
import { tokenize, normaliseCell, Unparsed, type Item, type Text } from './usgs-tokens';

// =====================================================================
// THE ROW AS A SHAPE
// =====================================================================

const NO_NAMED_COMPANY =
  /^(artisanal|small-scale|multiple|numerous|approximately|various|several|government$)/i;
const FACILITY_WORD =
  /\b(mines?|refinery|smelter|operations?|deposits?|plant|project|complex|concentrator|facility|field|pit|az|gok)\b/i;
const LIST_MARKERS = /\bof which\b|\bincluding:|\bwhich contains\b|:/i;

export type CellShape =
  /** A company at the head, perhaps with its owners. */
  | { kind: 'operator'; operator: Party }
  /** A list of holders of the facility, some perhaps marked operator. */
  | { kind: 'holders'; holders: Party[] }
  /** Parties each marked operator or owner, without shares. */
  | { kind: 'roles'; parties: Party[] }
  /** Several operating companies, each with its owners (`Companies: A (…) B (…)`). */
  | { kind: 'operators'; operators: Party[] };

/** The cell read as one of four shapes, or `Unparsed` with the reason. */
export function readCell(cell: string): CellShape {
  const text = normaliseCell(cell);
  if (!text) throw new Unparsed('empty cell');
  if (/^companies:/i.test(text)) return readCompaniesList(text.replace(/^companies:\s*/i, ''));
  if (/^[([{]/.test(text)) throw new Unparsed('starts with a bracket (continues another row)');
  const body = text.replace(/^(a )?joint venture of\s+/i, '');
  const items = tokenize(body);
  const topText = items
    .filter((i): i is Text => i.t === 'text')
    .map((i) => i.s)
    .join(' ');
  if (LIST_MARKERS.test(topText)) throw new Unparsed('"of which" or "including" list');
  if (NO_NAMED_COMPANY.test(body)) throw new Unparsed('names no company');

  const parties = readList(items);
  if (parties.some((p) => p.share !== undefined)) return { kind: 'holders', holders: parties };
  if (parties.length > 1) return { kind: 'roles', parties };
  const head = parties[0];
  if (!head?.name) throw new Unparsed('no name at the head of the cell');
  checkName(head.name);
  if (looksLikeOrganisation(head.name)) return { kind: 'operator', operator: head };
  if (FACILITY_WORD.test(head.name)) {
    if (head.owners.length) return { kind: 'holders', holders: head.owners };
    const companies = head.parents.filter((p) => looksLikeOrganisation(p.name));
    if (companies.length === 1) return { kind: 'operator', operator: companies[0] };
    throw new Unparsed('a facility name without one company in its bracket');
  }
  throw new Unparsed('the head is neither recognisably a company nor a facility');
}

/** `Companies: Akbastau JV (…) APPAK LLP (…) …` — names, each followed by its brackets. */
function readCompaniesList(text: string): CellShape {
  const items = tokenize(text);
  const operators: Party[] = [];
  let current: Item[] = [];
  for (const item of items) {
    if (item.t === 'text' && item.s.trim() && current.some((i) => i.t === 'group')) {
      operators.push(readParty(current));
      current = [];
    }
    current.push(item);
  }
  if (current.length) operators.push(readParty(current));
  return { kind: 'operators', operators };
}

export const COMMA_OK = /,\s*(s\.?a\.?|ltd|limited|inc|s\.a\.b|s\.a\.r\.l|co\b|llc|plc|b\.v|n\.v)/i;

/** A name we will not split: two firms run together, or a comma we cannot read. */
export function checkName(name: string): void {
  if (/\s(and|&)\s+(pt|jsc|oao|ojsc|ooo|pao|ao)\s/i.test(name))
    throw new Unparsed('two companies in one name');
  const commas = [...name.matchAll(/,/g)].map((m) => name.slice(m.index));
  if (commas.some((tail) => !COMMA_OK.test(tail)))
    throw new Unparsed('a comma inside the name: one company or two');
}

/** Why a holder gets no edge, or null when it may have one. */
export function holderProblem(p: Party): string | null {
  if (p.problem) return p.problem;
  if (p.share === undefined) return 'no percentage';
  if (!p.name) return 'no name';
  if (/\s(and|&)\s/i.test(p.name) && /(ltd|corp|inc|plc|co)\.?\s+(and|&)\s/i.test(p.name))
    return 'a joint holding by two names';
  if ([...p.name.matchAll(/,/g)].some((m) => !COMMA_OK.test(p.name.slice(m.index))))
    return 'a comma inside the holder name';
  return null;
}
