/**
 * Evidence: the corpus says sourced or unverified, and nothing else can
 * promote a row. Pages the sourcing engine finds live in its database queue
 * (`research_source_candidates`), are read live by the bottleneck pages, and
 * never change a row's state.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MATERIALS } from '../config/substrata';
import { VERIFICATION_LABEL, evidenceKey, verificationFor } from '../config/substrata-evidence';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { openCandidatesFor } from '../lib/source-store';

test('only a source on the coverage row makes it sourced', () => {
  assert.equal(verificationFor('https://example.org'), 'sourced');
  assert.equal(verificationFor(null), 'unverified');
  assert.equal(VERIFICATION_LABEL.candidate, 'Candidate source');
  for (const b of BOTTLENECKS) {
    for (const p of b.producers) {
      assert.equal(p.verification, p.source ? 'sourced' : 'unverified', `${b.name} / ${p.name}`);
    }
  }
});

test('the queue key is the one the sourcing run writes', () => {
  assert.equal(evidenceKey('Gallium', 'Acme'), 'Gallium :: Acme');
});

test('every material tells the engine what the trade calls it', () => {
  for (const material of MATERIALS) {
    assert.ok(
      material.search.trim().length > 1,
      `${material.title} has no search term for the engine`,
    );
  }
});

test('an unreadable queue reads as "could not look", never as "nothing found"', async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.equal(await openCandidatesFor('Gallium'), null);
  } finally {
    if (saved !== undefined) process.env.DATABASE_URL = saved;
  }
});

test('the bottleneck page reads unchecked sources from the queue, open rows only', () => {
  const store = readFileSync(join(process.cwd(), 'lib/source-store.ts'), 'utf8');
  const body = store.slice(store.indexOf('export async function openCandidatesFor'));
  assert.match(body, /FROM research_source_candidates/);
  assert.match(body, /reviewed_at IS NULL/);
});
