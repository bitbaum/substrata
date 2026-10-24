/**
 * The first pass over a USGS "major operating companies and major equity
 * owners" cell: brackets into a tree, footnote marks and percent-only brackets
 * normalised. What the tree means is read in ./usgs-grammar.ts and
 * ./usgs-cell.ts; the reading rules are stated in ./usgs-operators.ts.
 */
export interface Text {
  t: 'text';
  s: string;
}
export interface Group {
  t: 'group';
  open: string;
  items: Item[];
  raw: string;
}
export type Item = Text | Group;

export const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
export const CLOSERS = new Set(Object.values(PAIRS));

/** A cell, or a part of one, that the parser will not guess at. The message is the reason. */
export class Unparsed extends Error {}

/** Brackets into a tree. A bracket that never closes, or closes with the wrong mark, is a cut-off cell. */
export function tokenize(cell: string): Item[] {
  let at = 0;
  const walk = (closer: string | null): Item[] => {
    const items: Item[] = [];
    let text = '';
    while (at < cell.length) {
      const ch = cell[at];
      if (PAIRS[ch]) {
        if (text) items.push({ t: 'text', s: text });
        text = '';
        const start = at;
        at += 1;
        const inner = walk(PAIRS[ch]);
        items.push({ t: 'group', open: ch, items: inner, raw: cell.slice(start + 1, at - 1) });
        continue;
      }
      if (CLOSERS.has(ch)) {
        if (ch !== closer) throw new Unparsed('brackets do not match (the cell was cut off)');
        at += 1;
        if (text) items.push({ t: 'text', s: text });
        return items;
      }
      text += ch;
      at += 1;
    }
    if (closer) throw new Unparsed('a bracket never closes (the cell was cut off)');
    if (text) items.push({ t: 'text', s: text });
    return items;
  };
  return walk(null);
}

/** "Mine3 (", "GmbH1", "RUSAL)2": a footnote mark glued to a word, which the table prints as superscript. */
export const FOOTNOTE = /(?<=[A-Za-z)\]}.])[1-4](?=\s*[([{]|\s*$|\s*,)/g;
/** "(39.96%)" after a name is that name's share. */
export const SHARE_ONLY_GROUP = /\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\)/g;
export const SHARE = /,?\s*(\d+(?:\.\d+)?)\s*%/;
export const ROLE_GROUP = /^\s*(operator|owner|manager)\s*$/i;
export const TRAILING_ROLE = /,\s*(operator|manager)\s*$/i;
export const ABBREVIATION = /^[\p{L}\p{N}&.'’ -]{2,30}$/u;

export function normaliseCell(cell: string): string {
  return cell
    .replace(/\s+/g, ' ')
    .trim()
    .replace(FOOTNOTE, '')
    .replace(SHARE_ONLY_GROUP, ', $1%')
    .replace(/([)\]}])\s*\.$/, '$1')
    .trim();
}
