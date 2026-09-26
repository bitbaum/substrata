/**
 * Unreviewed sweep leads expire after LEAD_EXPIRY_DAYS (George, 2026-09-26).
 *
 * Three promises, each broken on purpose before this file was trusted:
 *  - the boundary: open strictly younger than the expiry, expired from it on,
 *    and the SQL predicate agrees with the JavaScript one at every age;
 *  - the review queue and its freshness age read OPEN leads only, so an old
 *    unread lead can no longer make /api/health/freshness return 503;
 *  - expired leads are kept and can be read back: listed by their own
 *    predicate, and nothing in the code deletes from the lead table.
 *
 * No build has a database, so the reads are checked against a fake pool that
 * records the SQL it is sent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  LEAD_EXPIRY_DAYS,
  REVIEW_QUEUE_LATE_DAYS,
  REVIEW_QUEUE_STALE_DAYS,
  expiredLeadSql,
  leadState,
  openLeadSql,
} from '../lib/lead-expiry';
import { queueState, BAD_STATES } from '../lib/freshness/status';

const DAY = 86_400_000;
const NOW = new Date('2026-09-26T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

test('the expiry boundary: open under LEAD_EXPIRY_DAYS, expired from it on', () => {
  assert.equal(LEAD_EXPIRY_DAYS, 30, 'the approved expiry is 30 days');
  assert.equal(leadState({ foundAt: ago(LEAD_EXPIRY_DAYS * DAY - 1) }, NOW), 'open');
  assert.equal(leadState({ foundAt: ago(LEAD_EXPIRY_DAYS * DAY) }, NOW), 'expired');
  assert.equal(leadState({ foundAt: ago(LEAD_EXPIRY_DAYS * DAY + 1) }, NOW), 'expired');
  assert.equal(leadState({ foundAt: ago(0) }, NOW), 'open');
  // A decision is a decision however old: expiry never overrides a verdict.
  assert.equal(leadState({ foundAt: ago(400 * DAY), reviewedAt: ago(390 * DAY) }, NOW), 'reviewed');
});

/** Evaluate one of the lead-expiry SQL predicates for a row, the way Postgres would. */
function sqlSays(predicate: string, row: { ageMs: number; reviewed: boolean }): boolean {
  const m = predicate.match(
    /^\((\w+\.)?reviewed_at IS NULL AND (\w+\.)?found_at (>|<=) now\(\) - interval '(\d+) days'\)$/,
  );
  assert.ok(m, `unrecognised predicate: ${predicate}`);
  if (row.reviewed) return false;
  const cutoffAge = Number(m[4]) * DAY;
  // found_at > now - N days  <=>  age < N days
  return m[3] === '>' ? row.ageMs < cutoffAge : row.ageMs >= cutoffAge;
}

test('the SQL predicates agree with leadState at every age, and split unreviewed leads in two', () => {
  const ages = [0, 1, DAY, 7 * DAY, 29 * DAY, LEAD_EXPIRY_DAYS * DAY - 1];
  ages.push(LEAD_EXPIRY_DAYS * DAY, LEAD_EXPIRY_DAYS * DAY + 1, 31 * DAY, 365 * DAY);
  for (const alias of [undefined, 'c']) {
    for (const ageMs of ages) {
      for (const reviewed of [false, true]) {
        const state = leadState({ foundAt: ago(ageMs), reviewedAt: reviewed ? ago(0) : null }, NOW);
        const open = sqlSays(openLeadSql(alias), { ageMs, reviewed });
        const expired = sqlSays(expiredLeadSql(alias), { ageMs, reviewed });
        assert.equal(open, state === 'open', `open at ${ageMs}ms, reviewed=${reviewed}`);
        assert.equal(expired, state === 'expired', `expired at ${ageMs}ms, reviewed=${reviewed}`);
        if (!reviewed) assert.ok(open !== expired, 'every unreviewed lead is open XOR expired');
      }
    }
  }
  assert.throws(() => openLeadSql('c; DROP TABLE x'), /alias/);
});

test('queue freshness on open leads: late is a slow reviewer, stale only a broken expiry', () => {
  const limits = { lateDays: REVIEW_QUEUE_LATE_DAYS, staleDays: REVIEW_QUEUE_STALE_DAYS };
  assert.ok(REVIEW_QUEUE_LATE_DAYS < LEAD_EXPIRY_DAYS, 'late must be reachable before expiry');
  assert.ok(REVIEW_QUEUE_STALE_DAYS >= LEAD_EXPIRY_DAYS, 'stale must lie past the expiry');
  // The oldest lead an intact queue can hold is just under the expiry: late, never stale.
  const oldestPossible = ago(LEAD_EXPIRY_DAYS * DAY - 1);
  assert.equal(queueState(oldestPossible, limits, NOW), 'late');
  assert.ok(!BAD_STATES.has(queueState(oldestPossible, limits, NOW)), 'must not 503');
  assert.equal(queueState(ago(REVIEW_QUEUE_LATE_DAYS * DAY - DAY), limits, NOW), 'fresh');
  // An open lead older than the expiry means the expiry is not applied: that IS an outage.
  assert.equal(queueState(ago((REVIEW_QUEUE_STALE_DAYS + 1) * DAY), limits, NOW), 'stale');
});

/** A pool that records every statement and answers with no rows. */
function recordingPool(): string[] {
  const sent: string[] = [];
  process.env.DATABASE_URL ??= 'postgres://recording-pool.invalid/none';
  (globalThis as { substrataPool?: unknown }).substrataPool = {
    query: async (sql: string) => {
      sent.push(sql.replace(/\s+/g, ' '));
      return { rows: [] };
    },
  };
  return sent;
}

test('the review queue, its oldest age and the open count read OPEN leads only', async () => {
  const sent = recordingPool();
  const open = openLeadSql('c').replace(/\s+/g, ' ');
  const { reviewQueue, openLeadsWithDrafts } = await import('../lib/event-draft-store');
  const { freshness } = await import('../lib/sweep-queue');

  sent.length = 0;
  const q = await reviewQueue();
  const counts = sent.find((s) => s.includes('AS waiting'));
  assert.ok(counts, 'reviewQueue sends its count query');
  assert.ok(
    counts.includes(`min(c.found_at) FILTER (WHERE ${open}) AS oldest`),
    'the freshness age must be the oldest OPEN lead',
  );
  assert.ok(counts.includes(`count(*) FILTER (WHERE ${open}) AS waiting`), 'waiting = open');
  assert.ok(
    counts.includes(`count(*) FILTER (WHERE ${expiredLeadSql('c')}) AS expired`),
    'expired are counted, apart',
  );
  assert.equal(q.expired, 0);

  sent.length = 0;
  await openLeadsWithDrafts();
  assert.ok(sent[0]?.includes(`WHERE ${open}`), 'the /review list is open leads only');

  sent.length = 0;
  await freshness();
  const sweepCount = sent.find((s) => s.includes('AS open'));
  assert.ok(sweepCount?.includes(`count(*) FILTER (WHERE ${openLeadSql()}) AS open`));
  assert.ok(sweepCount?.includes(`count(*) FILTER (WHERE ${expiredLeadSql()}) AS expired`));
});

test('expired leads are kept and can be read back', async () => {
  const sent = recordingPool();
  const { expiredCandidates, openCandidates } = await import('../lib/sweep-review');
  sent.length = 0;
  await expiredCandidates();
  assert.ok(sent[0]?.includes(`WHERE ${expiredLeadSql()}`), 'listed by the expired predicate');
  sent.length = 0;
  await openCandidates();
  assert.ok(sent[0]?.includes(`WHERE ${openLeadSql()}`));

  // Expiry is a reading. Nothing may delete a lead, or rewrite it as expired.
  const root = path.resolve(new URL('..', import.meta.url).pathname);
  const skip = new Set(['node_modules', '.next', '.git', '.claude', 'test']);
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|sql|mjs)$/.test(entry)) {
        const text = readFileSync(full, 'utf8');
        if (/DELETE\s+FROM\s+research_sweep_candidates/i.test(text)) offenders.push(full);
        if (/verdict\s*=\s*'expired'/i.test(text)) offenders.push(full);
      }
    }
  };
  walk(root);
  assert.deepEqual(offenders, [], 'expired leads are never deleted or rewritten');
});

test('the desk keeps the reader’s window but never presents an expired lead as awaiting review', async () => {
  const { buildFeed } = await import('../lib/desk');
  const lead = (id: string, days: number, expired: boolean) => ({
    id,
    bottleneck: 'Gallium refining',
    url: `https://example.com/${id}`,
    title: `Gallium refining capacity story ${id}`,
    published: null,
    foundAt: ago(days * DAY),
    expired,
    effectGuess: 'neutral' as const,
  });
  // A 45-day window reaches past the expiry; both leads stay, labelled apart.
  const feed = buildFeed([], [lead('new', 2, false), lead('old', 40, true)], NOW, 45);
  const byId = new Map(feed.map((item) => [item.id, item]));
  const old = byId.get('old');
  const young = byId.get('new');
  assert.ok(old?.source === 'lead' && old.expired, 'an expired lead is marked expired');
  assert.ok(young?.source === 'lead' && !young.expired, 'an open lead is not');
  const badge = readFileSync(
    path.resolve(new URL('../components/desk/FeedItem.tsx', import.meta.url).pathname),
    'utf8',
  );
  assert.ok(badge.includes('item.expired ?'), 'the desk badge branches on expiry');
  assert.ok(badge.includes('expired, never reviewed'));
});
