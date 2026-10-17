/**
 * The fact-check button sits on every page with a discussion: notes, learn
 * articles and every entity profile. The route only knew the two article kinds,
 * so the button on /science/high-na-euv answered 404.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { factcheckSubject } from '../lib/factcheck-subject';
import { allEntities } from '../lib/entities/registry';
import { allNotes } from '../lib/notes';

test('a science profile is a page that can be fact-checked', () => {
  const subject = factcheckSubject('/science/high-na-euv');
  assert.ok(subject, 'the reported page resolves');
  assert.match(subject.title, /EUV/i);
  assert.ok(subject.summary.length > 0);
});

test('every path the discussion module mounts on resolves', () => {
  // The same path the discussion module derives from an entity (shared.tsx).
  for (const entity of allEntities()) {
    const path = entity.href.split('?')[0];
    if (!path.startsWith('/')) continue;
    assert.ok(factcheckSubject(path), `${entity.id} at ${path}`);
  }
});

test('notes still resolve as articles', () => {
  const note = allNotes()[0];
  assert.ok(note, 'there is at least one note');
  assert.equal(factcheckSubject(`/notes/${note.slug}`)?.title, note.title);
});

test('a path that is not a page does not resolve', () => {
  assert.equal(factcheckSubject('/notes/no-such-note'), undefined);
  assert.equal(factcheckSubject('/science/no-such-entry'), undefined);
  assert.equal(factcheckSubject(''), undefined);
  assert.equal(factcheckSubject('/'), undefined);
  assert.equal(factcheckSubject('https://example.com/science/high-na-euv'), undefined);
});
