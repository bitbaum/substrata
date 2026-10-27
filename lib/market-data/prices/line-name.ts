/**
 * A price line is the right company's only if the source calls it by the
 * company's name. The seed's listings were each checked by hand; a listing
 * synthesised from a fund's ticker and venue was not, and a ticker can be
 * another company's on another exchange (or a share class with a space in
 * it). So the source's own name for the symbol is compared with ours before a
 * close is shown or stored, and a line that does not agree is refused with
 * both names, never drawn.
 */
import { nameKey } from '@/lib/sources/name-key';

const NOISE = new Set(['the', 'and', 'group', 'holding', 'international', 'technologies', 'class']);

const words = (name: string) =>
  nameKey(name)
    .split(' ')
    .filter((w) => w.length >= 3 && !NOISE.has(w));

/** True when the source's names share a distinctive word with the company's name. */
export function lineNameAgrees(expected: string, sourceNames: readonly string[]): boolean {
  // A source that gives no name at all cannot disagree; the chart still has the symbol.
  if (!sourceNames.length) return true;
  const want = words(expected);
  if (!want.length) return true;
  const got = new Set(sourceNames.flatMap(words));
  const squashed = sourceNames.map((n) => nameKey(n).replace(/ /g, ''));
  return want.some((w) => got.has(w) || squashed.some((s) => s.includes(w)));
}

export function lineNameMismatch(expected: string, sourceNames: readonly string[]): string {
  return `the price source calls this symbol “${sourceNames[0]}”, which does not match “${expected}”, so no line is drawn rather than another company's`;
}
