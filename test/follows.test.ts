import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFollows } from '../lib/follows';

test('follows parse a legacy technology array and a full desk object', () => {
  const legacy = parseFollows(['ai', 'energy', 'nope']);
  assert.deepEqual(legacy.technologies, ['ai', 'energy']);
  assert.equal(legacy.companies.length, 0);
  const full = parseFollows({
    technologies: ['ai'],
    companies: [],
    kind: 'organization',
  });
  assert.equal(full.kind, 'organization');
  assert.deepEqual(full.technologies, ['ai']);
});
