/**
 * The throttle when its table cannot be reached. Seen on production
 * 2026-11-12: Postgres refused connections ("too many clients already") and
 * every question was answered "temporarily unavailable", because the counter
 * threw. The limit must still hold, counted in the process.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allowLocally, allowRequest } from '../lib/request-guards';

test('the in-process window counts, refuses past the limit, and starts over when it ends', () => {
  const t0 = 1_800_000_000_000;
  assert.equal(allowLocally('k1', 2, 1, t0), true);
  assert.equal(allowLocally('k1', 2, 1, t0 + 1000), true);
  assert.equal(allowLocally('k1', 2, 1, t0 + 2000), false);
  // Another caller has its own count.
  assert.equal(allowLocally('k2', 2, 1, t0 + 2000), true);
  // An hour on, the window is new; a daily lane is still closed.
  assert.equal(allowLocally('k1', 2, 1, t0 + 3_600_001), true);
  assert.equal(allowLocally('day', 1, 24, t0), true);
  assert.equal(allowLocally('day', 1, 24, t0 + 3_600_001), false);
});

test('a database that cannot be reached does not refuse the reader, and the limit still holds', async () => {
  const before = { url: process.env.DATABASE_URL, secret: process.env.AUTH_SECRET };
  delete process.env.DATABASE_URL;
  process.env.AUTH_SECRET = 'test-secret';
  const errors = console.error;
  console.error = () => {};
  try {
    const request = new Request('https://substrata.test/api/chat', {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    assert.equal(await allowRequest(request, 'fallback-test', 2), true);
    assert.equal(await allowRequest(request, 'fallback-test', 2), true);
    assert.equal(await allowRequest(request, 'fallback-test', 2), false);
  } finally {
    console.error = errors;
    if (before.url === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = before.url;
    if (before.secret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = before.secret;
  }
});
