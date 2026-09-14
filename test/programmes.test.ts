/**
 * A programme may only cite rows the mandate has admitted. This is what stops
 * a research question from quietly widening the universe: if the answer needs
 * a node, the node enters coverage through the two tests first.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MATERIALS } from '../config/substrata';
import { CHOKEPOINTS } from '../config/substrata-coverage';
import {
  RESEARCH_PROGRAMMES,
  programmeProgress,
  rowsCitedBy,
} from '../config/substrata-programmes';

const UNIVERSE = new Set<string>([
  ...MATERIALS.map((m) => m.title),
  ...CHOKEPOINTS.map((c) => c.name),
]);

test('every row a programme cites exists in the coverage universe', () => {
  for (const programme of RESEARCH_PROGRAMMES) {
    for (const layer of programme.layers) {
      for (const row of layer.gatedBy) {
        assert.ok(
          UNIVERSE.has(row),
          `${programme.id} / ${layer.id} cites "${row}", which is not a material or chokepoint under coverage`,
        );
      }
    }
  }
});

test('every layer is gated by at least one row, and cites nothing twice', () => {
  for (const programme of RESEARCH_PROGRAMMES) {
    for (const layer of programme.layers) {
      assert.ok(
        layer.gatedBy.length > 0,
        `${programme.id} / ${layer.id} names nothing that gates it`,
      );
      assert.equal(
        new Set(layer.gatedBy).size,
        layer.gatedBy.length,
        `${programme.id} / ${layer.id} cites a row twice`,
      );
    }
  }
});

test('every open question names what would settle it', () => {
  for (const programme of RESEARCH_PROGRAMMES) {
    for (const question of programme.questions) {
      assert.ok(
        question.settledBy.trim().length > 20,
        `${programme.id} / ${question.id} has no settler`,
      );
      assert.ok(
        question.question.trim().endsWith('?'),
        `${programme.id} / ${question.id} is not a question`,
      );
    }
  }
});

test('ids are unique within a programme and programmes carry a real date', () => {
  for (const programme of RESEARCH_PROGRAMMES) {
    assert.match(programme.commissioned, /^\d{4}-\d{2}-\d{2}$/);
    for (const list of [programme.layers, programme.questions, programme.deliverables]) {
      const ids = list.map((item) => item.id);
      assert.equal(
        new Set(ids).size,
        ids.length,
        `${programme.id} repeats an id in ${ids.join(',')}`,
      );
    }
  }
});

test('progress counts deliverables honestly', () => {
  const programme = RESEARCH_PROGRAMMES[0];
  const progress = programmeProgress(programme);
  assert.equal(progress.total, programme.deliverables.length);
  assert.equal(
    progress.done + progress.inProgress,
    programme.deliverables.filter((d) => d.status !== 'not-started').length,
  );
  assert.ok(
    rowsCitedBy(programme).length >= MATERIALS.length,
    'the materials layer cites the whole universe',
  );
});
