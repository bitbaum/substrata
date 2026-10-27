/**
 * How a sentence is said to name an organisation, and how a name becomes a
 * page. Deliberately plain: a sentence names a party when it prints the
 * party's name, or the first word of it where that word is not a place.
 * Anything looser would call a derived edge stated.
 */
import { slugify } from '@/lib/links';

const PLACE_WORDS = new Set([
  'china',
  'chinese',
  'shanghai',
  'jiangsu',
  'yunnan',
  'zhuhai',
  'east',
  'west',
  'north',
  'south',
  'american',
  'global',
  'general',
  'united',
  'national',
  'royal',
  'carl',
]);

export function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Whether `quote` prints the name of `party` (the whole name, or its first word). */
export function namesParty(quote: string, party: string): boolean {
  const q = ` ${fold(quote)} `;
  const full = fold(party);
  if (full && q.includes(` ${full} `)) return true;
  const first = full.split(' ')[0] ?? '';
  return first.length >= 4 && !PLACE_WORDS.has(first) && q.includes(` ${first} `);
}

/** Whether a name printed in the dependency layer is the page `slug` (or its `name`). */
export function isSubject(printed: string, subject: { slug: string; name: string }): boolean {
  return printed === subject.name || slugify(printed) === subject.slug;
}
