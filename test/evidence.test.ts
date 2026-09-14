/**
 * The evidence file is engine output that the site reads. Two things must
 * hold or the map lies: every evidence row points at a producer row that
 * exists, and evidence never turns into a finding on its own.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COVERAGE } from '../config/substrata-coverage';
import {
  EVIDENCE,
  VERIFICATION_LABEL,
  evidenceFor,
  evidenceProgress,
  verificationFor,
} from '../config/substrata-evidence';

const ROWS = new Set(
  COVERAGE.flatMap((entry) => entry.producers.map((p) => `${entry.material} ${p.name}`)),
);

test('every evidence row refers to a producer row that exists', () => {
  assert.equal(EVIDENCE.version, 1);
  for (const row of EVIDENCE.rows) {
    assert.ok(
      ROWS.has(`${row.material} ${row.producer}`),
      `evidence for unknown row ${row.material} / ${row.producer}`,
    );
  }
});

test('a candidate carries a public URL and the excerpt that matched', () => {
  for (const row of EVIDENCE.rows) {
    if (row.status === 'candidate') {
      assert.ok(row.candidates.length > 0, `${row.producer} is a candidate with no pages`);
    } else {
      assert.equal(row.candidates.length, 0, `${row.producer} is ${row.status} but carries pages`);
    }
    for (const candidate of row.candidates) {
      assert.match(candidate.url, /^https?:\/\//, `${row.producer}: candidate URL is not http(s)`);
      assert.ok(candidate.excerpt.length > 0, `${row.producer}: candidate has no excerpt`);
      assert.ok(
        candidate.matched.length >= 2,
        `${row.producer}: a candidate must match the name and a material term`,
      );
    }
    assert.ok(!Number.isNaN(Date.parse(row.checkedAt)), `${row.producer}: checkedAt is not a date`);
  }
});

test('evidence never promotes a row on its own', () => {
  // A source on the coverage row wins; evidence can only ever say "candidate".
  assert.equal(verificationFor('any', 'any', 'https://example.org'), 'sourced');
  const candidate = EVIDENCE.rows.find((row) => row.status === 'candidate');
  if (candidate) {
    assert.equal(verificationFor(candidate.material, candidate.producer, null), 'candidate');
    assert.equal(evidenceFor(candidate.material, candidate.producer)?.status, 'candidate');
  }
  assert.equal(verificationFor('no such material', 'no such producer', null), 'unverified');
  assert.equal(VERIFICATION_LABEL.candidate, 'Candidate source');
});

test('progress sums to the rows examined', () => {
  const progress = evidenceProgress();
  assert.equal(progress.candidates + progress.nothing + progress.couldNotLook, progress.examined);
  assert.equal(progress.examined, EVIDENCE.rows.length);
});
