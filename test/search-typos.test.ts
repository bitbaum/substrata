import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluate, typoCases } from '@bitbaum/searchkit';
import { plain, search, searchDocuments, type SearchType } from '../lib/search';
import { defaultIndex } from '../lib/search/build';
import { words } from '../lib/search/text';

/**
 * One slip in a name still finds it. The misspellings are generated, not
 * imagined (`typoCases`: a neighbouring key on QWERTY or QWERTZ, a dropped
 * letter, a doubled one, a swapped pair), over the names people actually type
 * into this box: companies and countries.
 *
 * A slip that spells another word of the corpus ("Linde" → "line") is left
 * out: a real word is never corrected into a neighbour, on purpose
 * (`search/expand.ts`). Every third case is run, which keeps the suite quick
 * and still covers every name.
 */
const NAMED: SearchType[] = ['company', 'country'];

test('one slip in a company or country name still finds it first', async () => {
  // Stub companies (named only by a yearbook table, ranked below anything
  // profiled on purpose) are not names people type: a slip in one may well
  // find the profiled firm first, which is the ranking working.
  const docs = searchDocuments().filter((d) => NAMED.includes(d.type) && d.weight === undefined);
  const vocabulary = defaultIndex().vocab.counts;
  const title = new Map(docs.map((d) => [d.id, words(d.title)]));
  const cases = typoCases(
    docs.map((d) => ({ id: d.id, name: d.title })),
    { fold: words },
  )
    .filter((c) =>
      c.query.split(' ').every((w) => title.get(c.expect[0])!.includes(w) || !vocabulary.has(w)),
    )
    .filter((_, i) => i % 3 === 0);
  const report = await evaluate(cases, (q) => search(q, { limit: 5 }).hits.map((h) => h.id));
  const misses = report.misses.map((m) => `${m.query} → ${m.expect[0]}, got ${m.got.join(', ')}`);
  assert.ok(cases.length > 3000, `${cases.length} cases`);
  assert.equal(report.zeroResults, 0);
  assert.ok(report.successAt1 >= 0.995, `success@1 ${report.successAt1}`);
  assert.ok(
    report.successAt3 >= 0.998,
    `success@3 ${report.successAt3}:\n  ${misses.join('\n  ')}`,
  );
});

/** By hand: the slips the generator does not make, and the rules around them. */
const SLIPS: { q: string; top: string; why: string }[] = [
  { q: 'wolfsped', top: 'Wolfspeed', why: 'a dropped letter' },
  { q: 'ziess', top: 'Carl Zeiss SMT', why: 'a swap is one typo' },
  { q: 'sumitmo', top: 'Sumitomo Electric', why: 'inside a two-word name' },
  { q: 'photres', top: 'Photoresist', why: 'a slip in the start of the word being typed' },
  { q: 'canno', top: 'Canon', why: 'a word the corpus has only as the start of others' },
  {
    q: 'germaium',
    top: 'Announcement No. 23 of 2023 on export controls for gallium- and germanium-related items',
    why: 'a dropped letter in a long word',
  },
];

for (const { q, top, why } of SLIPS) {
  test(`search "${q}" finds "${top}" (${why})`, () => {
    const { hits } = search(q);
    assert.equal(
      hits[0] && plain(hits[0].title),
      top,
      hits
        .slice(0, 3)
        .map((h) => plain(h.title))
        .join(' | '),
    );
  });
}

test('a correction is marked in the title it found', () => {
  const [hit] = search('wolfsped').hits;
  assert.deepEqual(
    hit.title.filter((s) => s.hit).map((s) => s.text),
    ['Wolfspeed'],
  );
});

test('marks sit where an accented word stands in the original text', () => {
  const [hit] = search('wurttemberg').hits;
  assert.ok(hit, 'the Baden-Württemberg event should be found');
  assert.deepEqual(
    hit.snippet.filter((s) => s.hit).map((s) => s.text),
    ['Württemberg'],
  );
});

test('a real word is not corrected into a neighbour, so it brings no strangers', () => {
  const titles = search('neon', { limit: 50 }).hits.map((h) => plain(h.title));
  assert.ok(titles.some((t) => /neon/i.test(t)));
  assert.ok(!titles.includes('Neo Performance Materials'), titles.join(' | '));
});
