/**
 * The question, as a query.
 *
 * On 2026-09-20 a reader standing on the EUV lithography scanner page asked who
 * owns the company that makes them. The corpus does not hold ownership, so the
 * assistant looked the question up on the open web — verbatim, subject and all
 * missing — and was handed an explainer on public versus private limited
 * companies. The answer that came back was correct and useless.
 *
 * These tests hold the fix: the subject the reader can see on screen is the
 * head of the query, "this company" on a material page resolves to a company,
 * and a question that already names its subject is left alone.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  condense,
  followUpsFor,
  lookupQuery,
  lookupSubject,
  saysNotInCorpus,
} from '../lib/chat-query';

const SCANNERS = { name: 'EUV lithography scanners', kind: 'bottleneck' as const };
const ROWS = [
  { title: 'EUV lithography scanners', kind: 'bottleneck' as const },
  { title: 'ASML', kind: 'company' as const },
  { title: 'Netherlands', kind: 'country' as const },
];

test('"this company" on a material page resolves to the company that makes it', () => {
  const asked =
    "who owns this company is it a public company is a private company what's the history";
  assert.equal(lookupSubject(asked, SCANNERS, ROWS), 'ASML');
  assert.match(lookupQuery(asked, SCANNERS, ROWS), /^ASML /);
});

test('a question with no company in it still gets the page as its subject', () => {
  const asked = 'what would relieve this';
  assert.equal(lookupSubject(asked, SCANNERS, ROWS), 'EUV lithography scanners');
  assert.match(lookupQuery(asked, SCANNERS, ROWS), /^EUV lithography scanners /);
});

test('a question that already names its subject is not prefixed', () => {
  const asked = 'when did ASML buy Cymer';
  assert.equal(lookupQuery(asked, SCANNERS, ROWS), asked);
  // Case is not a different company.
  assert.equal(lookupQuery('who owns asml', SCANNERS, ROWS), 'who owns asml');
});

test('with nothing retrieved and no page, the question is the query', () => {
  assert.equal(lookupQuery('who makes gallium', undefined, []), 'who makes gallium');
});

test('politeness is dropped and long questions are cut on a word', () => {
  assert.equal(condense('  Could you please tell me  who owns it  '), 'who owns it');
  const long = condense(`who owns it ${'lithography '.repeat(40)}`);
  assert.ok(long.length <= 180, 'query is bounded');
  assert.doesNotMatch(long, /lithograp$/, 'cut on a word boundary, not mid-word');
});

test('a refusal is recognised however the model phrases it', () => {
  for (const said of [
    'Not in your data.',
    'The records do not identify the owner of the scanner maker.',
    'The corpus does not contain ownership information.',
    'There is nothing in the records about this.',
    'That is not covered in the corpus.',
  ]) {
    assert.equal(saysNotInCorpus(said), true, `should count as a refusal: ${said}`);
  }
});

test('an answer that used the corpus is not mistaken for a refusal', () => {
  for (const said of [
    'ASML is recorded as producing EUV lithography scanners [F2].',
    'The records identify one producer, and the join is a directory join [F1].',
    'Three suppliers are recorded, and the data covers all three [F1] [F2] [F3].',
  ]) {
    assert.equal(saysNotInCorpus(said), false, `should not count as a refusal: ${said}`);
  }
});

test('follow-ups are questions this assistant can answer, not instructions', () => {
  const next = followUpsFor(ROWS);
  assert.equal(next.length, 3);
  for (const question of next) assert.match(question, /\?$/);
  assert.ok(next.some((q) => q.includes('ASML')));
  assert.equal(new Set(next).size, next.length, 'no repeats');
});
