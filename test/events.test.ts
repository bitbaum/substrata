/**
 * Events and assessments are the analyst's claims about the universe. Each
 * must point at nodes that exist, use only the closed vocabularies, and carry
 * the dates that make it scorable later.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MATERIALS } from '../config/substrata';
import { ASSESSMENTS, bindingScore } from '../config/substrata-assessment';
import { CHOKEPOINTS, COVERAGE } from '../config/substrata-coverage';
import {
  EVENTS,
  EVENT_EFFECT_LABEL,
  EVENT_KIND_LABEL,
  EVENT_WORKLIST,
  eventsFor,
  eventsSince,
} from '../config/substrata-events';
import { PARTICIPANTS } from '../config/substrata-participants';
import { STAGES } from '../config/substrata-stages';

const UNIVERSE = new Set<string>([
  ...MATERIALS.map((m) => m.title),
  ...CHOKEPOINTS.map((c) => c.name),
]);
const PEOPLE = new Set<string>([
  ...PARTICIPANTS.map((p) => p.name),
  ...COVERAGE.flatMap((entry) => entry.producers.map((p) => p.name)),
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

test('every bottleneck has exactly one assessment, and every assessment names a bottleneck', () => {
  const named = ASSESSMENTS.map((a) => a.name);
  assert.equal(new Set(named).size, named.length, 'an assessment is repeated');
  for (const name of UNIVERSE) assert.ok(named.includes(name), `no assessment for ${name}`);
  for (const name of named) assert.ok(UNIVERSE.has(name), `assessment for unknown node ${name}`);
});

test('assessments use the closed vocabularies and stay inside the scale', () => {
  const stages = new Set(STAGES.map((s) => s.id));
  for (const a of ASSESSMENTS) {
    assert.ok(stages.has(a.stage), `${a.name}: unknown stage ${a.stage}`);
    assert.match(a.judgedOn, ISO_DATE, `${a.name}: judgedOn`);
    assert.ok(a.rationale.length > 40, `${a.name}: rationale too thin to disagree with`);
    const total = bindingScore(a.score);
    assert.ok(total >= 0 && total <= 12, `${a.name}: binding ${total}`);
  }
});

test('every event names real nodes, real participants, a real date and a closed kind and effect', () => {
  const ids = EVENTS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'an event id is repeated');
  for (const event of EVENTS) {
    assert.match(event.date, ISO_DATE, `${event.id}: date`);
    assert.match(event.acceptedOn, ISO_DATE, `${event.id}: acceptedOn`);
    assert.ok(event.date <= event.acceptedOn, `${event.id}: accepted before it happened`);
    assert.ok(
      event.headline.length > 0 && event.headline.length <= 140,
      `${event.id}: headline length`,
    );
    assert.ok(event.kind in EVENT_KIND_LABEL, `${event.id}: kind ${event.kind}`);
    assert.ok(event.effect in EVENT_EFFECT_LABEL, `${event.id}: effect ${event.effect}`);
    assert.ok(event.bottlenecks.length > 0, `${event.id}: names no bottleneck`);
    for (const name of event.bottlenecks)
      assert.ok(UNIVERSE.has(name), `${event.id}: unknown bottleneck ${name}`);
    for (const name of event.participants)
      assert.ok(PEOPLE.has(name), `${event.id}: unknown participant ${name}`);
    assert.match(event.source, /^https?:\/\//, `${event.id}: source`);
    assert.ok(event.quote.length > 10, `${event.id}: quote`);
  }
});

test('event lookups agree with the file', () => {
  const all = EVENTS.length;
  for (const name of UNIVERSE) {
    const mine = eventsFor(name);
    assert.ok(mine.every((e) => e.bottlenecks.includes(name)));
    for (let i = 1; i < mine.length; i++)
      assert.ok(mine[i - 1].date >= mine[i].date, 'not newest first');
  }
  assert.equal(eventsSince(100_000).length, all, 'a wide window returns everything');
  assert.equal(
    eventsSince(0, new Date('2030-01-01')).length,
    0,
    'a window that starts in the future returns nothing',
  );
});

test('the sweep worklist is a worklist: every entry names a real bottleneck and never an accepted state', () => {
  assert.equal(EVENT_WORKLIST.version, 1);
  for (const c of EVENT_WORKLIST.candidates) {
    assert.ok(UNIVERSE.has(c.bottleneck), `worklist names unknown bottleneck ${c.bottleneck}`);
    assert.ok(
      c.status === 'candidate' || c.status === 'could_not_look',
      `${c.id}: status ${c.status}`,
    );
    if (c.status === 'candidate') assert.match(c.url, /^https?:\/\//, `${c.id}: url`);
  }
});
