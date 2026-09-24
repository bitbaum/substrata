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

import { DEFAULT_DESK, normaliseHost, parseDesk, railsOf } from '../lib/follows';
import { BOTTLENECKS } from '../lib/bottlenecks';

test('desk settings clamp every number and drop what they cannot parse', () => {
  const desk = parseDesk({
    window: 'forever',
    leadMaxAgeDays: 9999,
    staleAfterHours: -4,
    pageSize: 'lots',
    mutedHosts: ['finance.yahoo.com', 'not a host', 42],
    mutedWords: ['x', 'stock', 'stock'],
    readUntil: 'yesterday-ish',
  });
  assert.equal(desk.window, DEFAULT_DESK.window);
  assert.equal(desk.leadMaxAgeDays, 365);
  assert.equal(desk.staleAfterHours, 1);
  assert.equal(desk.pageSize, DEFAULT_DESK.pageSize);
  assert.deepEqual(desk.mutedHosts, ['finance.yahoo.com']);
  assert.deepEqual(desk.mutedWords, ['stock']);
  assert.equal(desk.readUntil, null);
});

test('a site is muted by its host, however it was pasted', () => {
  assert.equal(normaliseHost('https://www.Reuters.com/markets/x'), 'reuters.com');
  assert.equal(normaliseHost('sg.finance.yahoo.com'), 'sg.finance.yahoo.com');
  assert.equal(normaliseHost('nonsense'), null);
});

test('rails: following nothing shows everything, muting always wins', () => {
  const all = railsOf(parseFollows({}));
  assert.equal(all.length, BOTTLENECKS.length);
  const [first, second] = BOTTLENECKS;
  const muted = railsOf(parseFollows({ muted: [first.slug] }));
  assert.ok(!muted.some((b) => b.slug === first.slug));
  const one = railsOf(parseFollows({ bottlenecks: [second.slug] }));
  assert.deepEqual(
    one.map((b) => b.slug),
    [second.slug],
  );
  const both = parseFollows({ bottlenecks: [first.slug], muted: [first.slug] });
  assert.deepEqual(both.bottlenecks, [], 'following and muting one row: muting wins');
});
