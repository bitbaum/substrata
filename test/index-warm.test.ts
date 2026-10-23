/**
 * The chunk index is warmed at server start without holding the start up:
 * `register()` returns at once, the build runs later, and a failing build only
 * logs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { register } from '../instrumentation';
import { warmIndex } from '../lib/index/warm';

test('warmIndex returns before the build runs, and runs it on a later turn', async () => {
  let built = false;
  warmIndex(() => {
    built = true;
  });
  assert.equal(built, false, 'the build has not run when warmIndex returns');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(built, true, 'the build ran on the next turn');
});

test('a failing build is logged, never thrown', async () => {
  const logged: string[] = [];
  let ran: (() => void) | undefined;
  assert.doesNotThrow(() =>
    warmIndex(
      () => {
        throw new Error('boom');
      },
      (run) => (ran = run),
      (message) => logged.push(message),
    ),
  );
  assert.doesNotThrow(() => ran!());
  assert.equal(logged.length, 1);
});

test('register() does not throw and returns before the build finishes', () => {
  const before = process.env.NEXT_RUNTIME;
  process.env.NEXT_RUNTIME = 'nodejs';
  try {
    const started = Date.now();
    assert.doesNotThrow(() => register());
    // The build takes seconds; returning this fast means it was not waited for.
    assert.ok(Date.now() - started < 200, `register() took ${Date.now() - started} ms`);
    process.env.NEXT_RUNTIME = 'edge';
    assert.doesNotThrow(() => register());
  } finally {
    if (before === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = before;
  }
});
