/**
 * "Update news now" and automatic updates: the inputs a browser controls
 * land on a safe default, and automatic AI updates are off unless chosen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AUTO_DRAFT_CAPS, DEFAULT_DESK, parseDesk } from '../lib/follows';
import { parseScope } from '../lib/update-now';
import { needsDraft, type UpdateLead } from '../lib/update-shared';

test('a scope names a bottleneck, a company or the desk — nothing else', () => {
  assert.deepEqual(parseScope({ kind: 'bottleneck', slug: 'euv-lithography' }), {
    kind: 'bottleneck',
    slug: 'euv-lithography',
  });
  assert.deepEqual(parseScope({ kind: 'desk', slug: 'ignored' }), { kind: 'desk' });
  assert.equal(parseScope({ kind: 'company', slug: '../../etc' }), null);
  assert.equal(parseScope({ kind: 'bottleneck' }), null);
  assert.equal(parseScope({ kind: 'everything' }), null);
  assert.equal(parseScope(null), null);
});

test('automatic AI updates are off by default and the cap is clamped to the offered range', () => {
  assert.equal(DEFAULT_DESK.autoDraft, false);
  assert.equal(parseDesk({}).autoDraft, false);
  assert.equal(parseDesk({ autoDraft: 'yes' }).autoDraft, false);
  assert.equal(parseDesk({ autoDraft: true }).autoDraft, true);
  const max = AUTO_DRAFT_CAPS[AUTO_DRAFT_CAPS.length - 1];
  assert.equal(parseDesk({ autoDraftPerDay: 100_000 }).autoDraftPerDay, max);
  assert.equal(parseDesk({ autoDraftPerDay: -3 }).autoDraftPerDay, AUTO_DRAFT_CAPS[0]);
  assert.equal(parseDesk({ autoDraftPerDay: 'x' }).autoDraftPerDay, DEFAULT_DESK.autoDraftPerDay);
});

test('a summary is offered only for leads it would add something to', () => {
  const lead = (draft: UpdateLead['draft']): UpdateLead => ({
    id: 'a',
    title: 't',
    url: 'https://example.com',
    host: 'example.com',
    bottleneck: 'b',
    bottleneckSlug: null,
    foundAt: '2026-09-25T00:00:00Z',
    draft,
  });
  const d = (status: NonNullable<UpdateLead['draft']>['status']) => ({
    status,
    suggestion: null,
    headline: null,
    date: null,
    reason: '',
  });
  assert.equal(needsDraft(lead(null)), true);
  assert.equal(needsDraft(lead(d('could_not_read'))), true);
  assert.equal(needsDraft(lead(d('drafted'))), false);
  assert.equal(needsDraft(lead(d('duplicate'))), false);
});
