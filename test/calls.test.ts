/**
 * A call is the only thing on this site that can be wrong, which makes it the
 * thing most worth protecting from quiet editing. These tests enforce the
 * rules that make one scoreable: a date, a real subject, and an observation a
 * stranger could check.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MATERIALS } from '../config/substrata';
import { INVESTMENT_THESIS } from '../config/substrata-acting';
import {
  CALLS,
  SCORING_THRESHOLD,
  callsAbout,
  callsTesting,
  isOverdue,
  openCalls,
  record,
  resolvedCalls,
} from '../config/substrata-calls';
import { CHOKEPOINTS } from '../config/substrata-coverage';
import { EVENTS } from '../config/substrata-events';

const UNIVERSE = new Set<string>([
  ...MATERIALS.map((m) => m.title),
  ...CHOKEPOINTS.map((c) => c.name),
]);
const CLAIM_IDS = new Set(INVESTMENT_THESIS.map((c) => c.id));
const EVENT_IDS = new Set(EVENTS.map((e) => e.id));
const ISO = /^\d{4}-\d{2}-\d{2}$/;

test('every call is dated, resolvable, and about something that exists', () => {
  const ids = CALLS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'a call id is repeated');
  assert.ok(CALLS.length > 0, 'no calls: the record cannot start');

  for (const call of CALLS) {
    assert.match(call.madeOn, ISO, `${call.id}: madeOn`);
    assert.match(call.resolveBy, ISO, `${call.id}: resolveBy`);
    assert.ok(call.resolveBy > call.madeOn, `${call.id}: resolves before it was made`);
    assert.ok(CLAIM_IDS.has(call.tests), `${call.id}: tests an unknown thesis claim`);
    assert.ok(call.bottlenecks.length > 0, `${call.id}: about nothing`);
    for (const name of call.bottlenecks) {
      assert.ok(UNIVERSE.has(name), `${call.id}: unknown bottleneck ${name}`);
    }
  }
});

test('every call names an observation a stranger could check', () => {
  // The failure mode this guards against is a settler that restates the claim
  // or appeals to a feeling — "if the situation deteriorates" is not a test.
  const VAGUE = /\b(seems|feels|appears to be going|generally|broadly|sentiment|momentum)\b/i;
  for (const call of CALLS) {
    assert.ok(call.settledBy.length > 60, `${call.id}: settler too thin to check`);
    assert.ok(!VAGUE.test(call.settledBy), `${call.id}: settler appeals to a feeling`);
    assert.ok(call.claim.length > 40, `${call.id}: claim too short to be specific`);
    assert.ok(call.reasoning.length > 80, `${call.id}: no reasoning to argue with`);
    // A settler should name a source, a number, a date or a body — something
    // external. A settler with none of those is a restatement.
    assert.ok(
      /\d|survey|report|dataset|series|filing|announcement|list|guidance|earnings|published/i.test(
        call.settledBy,
      ),
      `${call.id}: settler names nothing external`,
    );
  }
});

test('a resolved call cites events that exist, and an unresolved one claims nothing', () => {
  for (const call of CALLS) {
    if (call.resolution === null) continue;
    assert.match(call.resolution.on, ISO, `${call.id}: resolution date`);
    assert.ok(call.resolution.on >= call.madeOn, `${call.id}: resolved before it was made`);
    assert.ok(call.resolution.why.length > 40, `${call.id}: resolution has no reasoning`);
    for (const id of call.resolution.events) {
      assert.ok(EVENT_IDS.has(id), `${call.id}: cites an event that does not exist — ${id}`);
    }
  }
});

test('the record counts honestly and refuses to publish a rate too early', () => {
  const score = record();
  assert.equal(score.total, CALLS.length);
  assert.equal(score.open + score.right + score.wrong + score.unclear, CALLS.length);
  assert.equal(score.open, openCalls().length);
  assert.equal(score.right + score.wrong + score.unclear, resolvedCalls().length);
  // The whole point: with few resolved calls, no percentage is shown.
  assert.equal(
    score.enoughToScore,
    resolvedCalls().length >= SCORING_THRESHOLD,
    'the scoring threshold is not being applied',
  );
  if (resolvedCalls().length < SCORING_THRESHOLD) {
    assert.equal(score.enoughToScore, false, 'a hit rate would be published from too few calls');
  }
});

test('lookups agree with the file', () => {
  for (const call of CALLS) {
    assert.ok(callsTesting(call.tests).includes(call), `${call.id}: not found by its thesis claim`);
    for (const name of call.bottlenecks) {
      assert.ok(callsAbout(name).includes(call), `${call.id}: not found under ${name}`);
    }
  }
  // Open calls are ordered by what comes due first — the ones with something at stake.
  const open = openCalls();
  for (let i = 1; i < open.length; i++) {
    assert.ok(open[i - 1].resolveBy <= open[i].resolveBy, 'open calls are not soonest-first');
  }
  // Overdue is a function of the date, not a stored flag that can rot.
  assert.equal(isOverdue(CALLS[0], new Date('2020-01-01')), false);
  assert.equal(
    isOverdue({ ...CALLS[0], resolution: null }, new Date('2099-01-01')),
    true,
    'a long-past call is not being flagged overdue',
  );
});

test('the calls are spread across the thesis rather than all testing one claim', () => {
  const tested = new Set(CALLS.map((c) => c.tests));
  assert.ok(
    tested.size >= 3,
    'every call tests the same one or two claims; the thesis is mostly unscoreable',
  );
});
