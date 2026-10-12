/**
 * Highlighting and snippets: which words to mark in the original text, and
 * the window of summary or body shown under a result. Cutting the window and
 * splitting text into marked runs are `@bitbaum/searchkit`'s; choosing which
 * text to show is this site's.
 */
import { snippet as excerpt, type Range } from '@bitbaum/searchkit';
import { segments, type Segment } from '../search-types';
import type { SearchDoc } from './corpus';
import { terms } from './text';

/**
 * Every word of `text` whose folded form matched, whole. Offsets are into the
 * original text, so "Zürich" is marked where it stands; and a match on
 * "wafer" marks "wafers", which folds to it.
 */
export function marks(text: string, matched: ReadonlySet<string>): Range[] {
  return terms(text).filter((t) => matched.has(t.term));
}

const SNIPPET = { maxLength: 190, lead: 60 };

/** A window of the summary or body around the first marked word. */
export function snippet(
  doc: SearchDoc,
  matched: ReadonlySet<string>,
  titleMatched: boolean,
): Segment[] {
  // When the name already shows why this matched, the plain description is
  // worth more than a passage of body text that happens to repeat the name.
  for (const text of titleMatched ? [doc.summary] : [doc.summary, doc.body]) {
    const ranges = text ? marks(text, matched) : [];
    if (!ranges.length) continue;
    const cut = excerpt(text, ranges, SNIPPET);
    return segments(cut.text, cut.ranges);
  }
  return segments(excerpt(doc.summary || doc.body, [], SNIPPET).text);
}
