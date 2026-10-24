/**
 * The answer that redid the table (2026-10-24, live, after the code table
 * shipped): its own markdown table above ours, "24 000 metric tons" on every
 * row, "50 %" for "50%", and aggregates of its own ("17 mining
 * joint-ventures", "at least 49%", "up to 50%"). Graded here on the recorded
 * answers and the recorded producers_in result (test/fixtures/).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import recorded from './fixtures/kz-uranium-producers-in-2026-10-24.json';
import { checkAnswer } from '../lib/chat-agent/check-answer';
import { printedFormMismatches, unsupportedFigures } from '../lib/chat-agent/grounding';
import {
  claimProblems,
  replaceClaims,
  stripModelTables,
  tableFactsIn,
} from '../lib/chat-agent/table-guard';
import type { ModelTurn } from '../lib/chat-agent/turn';
import { facilitySummary } from '../lib/chat-tools/facility-summary';
import fixture from '../scripts/ux/fixtures/kz-uranium-table.json';
import type { AnswerTable } from '../lib/chat/answer-table';

const live = readFileSync(
  new URL('./fixtures/ask-live-kz-uranium-2026-10-24.md', import.meta.url),
  'utf8',
);
const owner = readFileSync(
  new URL('./fixtures/ask-owner-kz-uranium-2026-10-24.md', import.meta.url),
  'utf8',
);
const results = recorded.results;
const facts = tableFactsIn(results)!;

test('the summary is counted from the parsed rows, not written', () => {
  assert.deepEqual(facilitySummary(fixture as AnswerTable, 'kz'), [
    'The table has 17 rows: 16 for “Uranium, U content” and 1 for “Rare earth elements, recovered from uranium-ore residue”.',
    // "NAC Kazatomp JSC" (PE Ortalyk) counts: the reviewed alias.
    'NAC Kazatomprom JSC is named as an owner in 16 of the 17 rows; its stated shares range from 30% to 100%.',
    'Uranium One Inc. is named as an owner in 2 of the 17 rows; its stated shares range from 20% to 50%.',
  ]);
  assert.deepEqual(facts.summary, facilitySummary(fixture as AnswerTable, 'kz'));
  assert.deepEqual(facts.printedOnce, ['24000 metric tons']);
  const result = JSON.parse(results[0].replace(/^\[[^\]]+\]\s*/, '')) as { table_shown: string };
  assert.match(result.table_shown, /Do NOT write a table/);
  assert.match(result.table_shown, /printed ONCE/);
});

test('the summary counts a row with no printed share apart', () => {
  const row = (operator: string, owners: string) => ({
    operator,
    owners,
    commodity: 'U',
    location: null,
    capacity: null,
    year: '2023',
  });
  const t = {
    ...(fixture as AnswerTable),
    rows: [
      row('A LLP', 'X Corp., 50%, and Y Ltd., 50%'),
      row('B LLP', 'Y Ltd., 60%, and X Corp.'),
      row('C LLP', 'X Corp., 100%'),
      row('D LLP', 'Q Corp., 100%'),
    ],
  };
  assert.equal(
    facilitySummary(t, 'kz')[1],
    'X Corp. is named as an owner in 3 of the 4 rows; its stated shares range from 50% to 100%; no share is printed for 1.',
  );
});

test('the model’s own table and its per-row capacity are stripped from the prose', () => {
  for (const answer of [live, owner]) {
    const out = stripModelTables(answer, facts.printedOnce);
    assert.ok(!/^\s*\|/m.test(out), 'no markdown table left');
    assert.ok(!/24[\s  ]?000/.test(out), 'no per-row capacity left');
    assert.match(out, /not in our sources|does not contain buyer/, 'the missing link stays');
  }
  // Prose without a table is left alone.
  const plain = 'NAC Kazatomprom JSC holds 60% of JV Inkai LLP. The table below lists them.';
  assert.equal(stripModelTables(plain, facts.printedOnce), plain);
});

test('aggregates of the model’s own are caught; the computed sentences pass', () => {
  const claims = claimProblems(stripModelTables(owner, facts.printedOnce), facts.summary);
  assert.deepEqual(claims, [
    'The USGS Minerals Yearbook 2023 lists 17 mining joint-ventures in Kazakhstan.',
    'The largest single-stake owners are Kazatomprom (50% or more) and Uranium One Inc. (up to 50%).',
    'All operators are JVs in which Kazatomprom holds at least 49%.',
  ]);
  const liveClaims = claimProblems(stripModelTables(live, facts.printedOnce), facts.summary);
  assert.ok(liveClaims.some((c) => c.startsWith('The table shows 17 distinct operators')));
  assert.ok(liveClaims.some((c) => /^The largest single stake listed is 100\s%/.test(c)));
  const good = `${facts.summary.join(' ')} The buyers are not in our sources.`;
  assert.deepEqual(claimProblems(good, facts.summary), []);
  assert.deepEqual(claimProblems('- **' + facts.summary[1] + '**', facts.summary), []);
  const replaced = replaceClaims(owner, claims, facts.summary);
  assert.ok(replaced.includes(facts.summary[1]));
  assert.ok(!replaced.includes('at least 49%'));
});

test('a printed figure re-formatted is caught: "50 %" for "50%", "24 000" for "24000"', () => {
  const evidence = results.join('\n');
  assert.deepEqual(
    printedFormMismatches('NAC Kazatomprom JSC, 50 %, and 24 000 metric tons', evidence),
    ['50 %', '24 000'],
  );
  assert.deepEqual(
    printedFormMismatches('NAC Kazatomprom JSC, 50%, 24000 metric tons', evidence),
    [],
  );
  assert.ok(
    unsupportedFigures('Sumitomo Corp. holds 25 % of APPAK LLP.', evidence).includes('25 %'),
  );
});

test('check-answer: the recorded answer goes back once and comes out with the summary', async () => {
  const sent: string[] = [];
  const turn: ModelTurn = async ({ messages }) => {
    sent.push(String(messages[messages.length - 1].content));
    // The model obeys this time: the summary, then the missing link.
    return {
      text: `${facts.summary.join(' ')}\n\nThe buyers of Kazakhstan's uranium output are not in our sources.`,
      calls: [],
    } as never;
  };
  const out = await checkAnswer({
    answer: owner,
    question: recorded.question,
    results,
    messages: [{ role: 'user', content: results.join('\n') }],
    verify: false,
    turn,
    emit: () => {},
    fileGap: async () => {},
  });
  assert.equal(sent.length, 1, 'sent back once');
  assert.match(sent[0], /not computed from the rows/);
  assert.ok(out.answer.startsWith(facts.summary[0]));
  assert.ok(!/\|/.test(out.answer));

  // A model that ignores it twice: its aggregates are replaced in code.
  const stubborn: ModelTurn = async () => ({ text: owner, calls: [] }) as never;
  const forced = await checkAnswer({
    answer: owner,
    question: recorded.question,
    results,
    messages: [{ role: 'user', content: results.join('\n') }],
    verify: false,
    turn: stubborn,
    emit: () => {},
    fileGap: async () => {},
  });
  assert.ok(!forced.answer.includes('at least 49%'));
  assert.ok(!forced.answer.includes('17 mining joint-ventures'));
  assert.ok(forced.answer.includes(facts.summary[1]));
});
