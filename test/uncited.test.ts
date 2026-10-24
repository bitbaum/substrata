/**
 * Nothing is made up (lib/chat-agent/uncited.ts): a claim on a link the
 * sources do not hold survives only with a fetched [W#] or a corpus link, and
 * gives way to the precise gap sentence; uncited background about a firm the
 * table names goes too. The live answers are graded in ask-evals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import recorded from './fixtures/kz-uranium-producers-in-2026-10-24.json';
import { missingLinks } from '../lib/chat-agent/ladder';
import { tableFactsIn } from '../lib/chat-agent/table-guard';
import {
  dropUncited,
  tableEntityWords,
  uncitedClaims,
  webCountIn,
} from '../lib/chat-agent/uncited';

const facts = tableFactsIn(recorded.results)!;
const gaps = missingLinks(recorded.question, recorded.results);
const entities = tableEntityWords(facts);
const check = (answer: string, webCount = 2) =>
  uncitedClaims(answer, { gaps, entities, webCount, summary: facts.summary }).map(
    (c) => c.sentence,
  );

test('the missing link here is the buyers, and the table names its firms', () => {
  assert.deepEqual(
    gaps.map((g) => g.box),
    ['buyers'],
  );
  for (const w of ['kazatomprom', 'cameco', 'sumitomo', 'ortalyk'])
    assert.ok(entities.includes(w), w);
  for (const w of ['private', 'investors', 'uranium', 'kazakh'])
    assert.ok(!entities.includes(w), w);
});

test('a claim on the missing link needs a fetched page or a link', () => {
  const made = 'Kazakh uranium is sold to utilities in Europe and Asia under long-term contracts.';
  assert.deepEqual(check(made), [made]);
  assert.deepEqual(check('A page says China is the largest buyer of Kazakh uranium [W1].'), []);
  // A marker for a page nobody fetched cites nothing.
  assert.equal(check('China is the largest buyer of Kazakh uranium [W7].').length, 1);
  assert.deepEqual(
    check(
      'Cameco reports selling its share of Inkai output to utilities ([Cameco 20-F](https://www.sec.gov/x)).',
    ),
    [],
  );
});

test('what an honest answer says about the gap stays', () => {
  for (const s of [
    "The buyers of Kazakhstan's uranium output are not in our sources.",
    'A source that would settle it: offtake and supply agreements disclosed in annual reports.',
    'The dataset does not contain buyer information for Kazakh uranium.',
    'These are unchecked web pages, not part of the corpus:',
    'If you have primary offtake contracts, you can send evidence to get them tracked.',
    ...facts.summary,
  ])
    assert.deepEqual(check(s), [], s);
});

test('uncited background about a firm the table names goes, cited stays', () => {
  const bg = 'Outside the corpus — Kazatomprom is the world’s largest uranium producer.';
  assert.deepEqual(check(bg), [bg]);
  assert.deepEqual(
    check(
      'Kazatomprom reported its output for 2025 ([Kazatomprom](https://www.kazatomprom.kz/x)).',
    ),
    [],
  );
});

test('the gap sentence stands where a dropped claim was, unless it is already said', () => {
  const made = 'Kazatomprom sells uranium to utilities across North America, Europe and Asia.';
  const answer = `${facts.summary.join(' ')}\n\n${made}\n\nSee the table below.`;
  const out = dropUncited(answer, uncitedClaims(answer, { gaps, entities, webCount: 0 }), gaps);
  assert.ok(!out.includes('North America'));
  assert.ok(out.includes(gaps[0].sentence), 'the precise gap sentence');
  assert.ok(out.includes(gaps[0].settles), 'and what would settle it');
  const said = `${gaps[0].sentence}\n\n${made}`;
  const again = dropUncited(said, uncitedClaims(said, { gaps, entities, webCount: 0 }), gaps);
  assert.equal(again.split(gaps[0].sentence).length - 1, 1, 'said once');
});

test('the [W#] an answer may cite are the ones its lookups fetched', () => {
  const web = `[web_search] ${JSON.stringify({ status: 'found', results: [{ cite_as: 'W1' }, { cite_as: 'W2' }] })}`;
  assert.equal(webCountIn([web]), 2);
  assert.equal(webCountIn([]), 0);
});

test('a fetched page’s claim on the missing link is said as the page’s', () => {
  const bare = 'China is the largest buyer of Kazakh uranium [W1].';
  const claims = uncitedClaims(bare, { gaps, entities, webCount: 2 });
  assert.equal(claims.length, 1);
  assert.equal(
    dropUncited(bare, claims, gaps),
    'According to an unchecked web page, China is the largest buyer of Kazakh uranium [W1].',
  );
});
