/**
 * One row under an answer: suggested replies first, then the corpus
 * follow-ups, nothing twice, at most five.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { answerRow, MAX_ROW } from '../lib/ask-row';

test('replies come first, then the follow-ups', () => {
  assert.deepEqual(answerRow(['Yes', 'Show sources'], ['Who is recorded as producing gallium?']), [
    'Yes',
    'Show sources',
    'Who is recorded as producing gallium?',
  ]);
});

test('the same question is offered once, whatever its case or question mark', () => {
  assert.deepEqual(
    answerRow(
      ['who is recorded as producing gallium', 'No'],
      ['Who is recorded as producing gallium?', 'Which bottlenecks does REACH touch?'],
    ),
    ['who is recorded as producing gallium', 'No', 'Which bottlenecks does REACH touch?'],
  );
});

test(`never more than ${MAX_ROW}, and a full set of replies still leaves a follow-up`, () => {
  const row = answerRow(['a', 'b', 'c', 'd'], ['e?', 'f?', 'g?']);
  assert.equal(row.length, MAX_ROW);
  assert.deepEqual(row, ['a', 'b', 'c', 'd', 'e?']);
});

test('nothing in, nothing out; blanks are not buttons', () => {
  assert.deepEqual(answerRow(), []);
  assert.deepEqual(answerRow(['  '], ['']), []);
});
