import { test } from 'node:test';
import assert from 'node:assert/strict';
import { within } from '../lib/within';

test('an answer in time passes through', async () => {
  assert.equal(await within(Promise.resolve('reader'), 50, 'session read'), 'reader');
});

test('no answer in time is a rejection that names what hung, not a hang', async () => {
  const started = Date.now();
  await assert.rejects(
    within(new Promise(() => {}), 30, 'session read'),
    /session read: no answer within 30ms/,
  );
  assert.ok(Date.now() - started < 1000);
});

test('a failure inside passes through as itself', async () => {
  await assert.rejects(
    within(Promise.reject(new Error('relation missing')), 50, 'x'),
    /relation missing/,
  );
});
