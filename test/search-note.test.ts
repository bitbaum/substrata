/**
 * What a run's searches did, kept with the run. Seen on production 2026-11-12:
 * the sweep and producer sourcing failed for a day and the freshness page said
 * only "Failing". The note names the backend and how it failed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { searchNote, searchNotes } from '../lib/search-note';
import { failureNote } from '../lib/freshness/read';
import { FEEDS } from '../config/substrata-freshness';

const down = {
  status: 'could_not_look' as const,
  attempts: [
    {
      provider: 'searxng',
      outcome: 'failed' as const,
      failure: { kind: 'unreachable' as const, reason: 'x' },
    },
  ],
};
const empty = {
  status: 'nothing' as const,
  attempts: [{ provider: 'searxng', outcome: 'empty' as const, count: 0 }],
};
const found = {
  status: 'found' as const,
  attempts: [{ provider: 'searxng', outcome: 'results' as const, count: 6 }],
};

test("a search note is ai-kit's one line about each backend", () => {
  assert.equal(searchNote(down), 'searxng unreachable');
  assert.equal(searchNote(found), 'searxng 6');
  assert.equal(searchNote({ status: 'could_not_look', attempts: [] }), 'no backend');
});

test('a run keeps the note that explains the most: a failed look over an empty one over pages', () => {
  const notes = searchNotes();
  assert.equal(notes.note, null);
  notes.add(found);
  assert.equal(notes.note, 'searxng 6');
  notes.add(down);
  notes.add(found);
  notes.add(empty);
  assert.equal(notes.note, 'searxng unreachable');
});

test('a failing feed shows what its search backends did, when the run recorded it', () => {
  const sweep = FEEDS.find((f) => f.id === 'sweep')!;
  assert.equal(sweep.noteColumn, 'search_note');
  assert.equal(
    failureNote(sweep, false, 'searxng timeout'),
    'In the last failed run, no search reached a search backend. Search backends: searxng timeout.',
  );
  assert.equal(failureNote(sweep, false, null), sweep.failedMeans);
  assert.match(failureNote(sweep, true, 'searxng timeout'), /did not finish/);
});

test('/api/health/web reports names only, and asks once however many ask at once', async () => {
  const saved = ['SEARXNG_URL', 'BRAVE_SEARCH_API_KEY', 'TAVILY_API_KEY'].map((k) => [
    k,
    process.env[k],
  ]);
  for (const [k] of saved) delete process.env[k!];
  try {
    const { GET } = await import('../app/api/health/web/route');
    const [a, b] = await Promise.all([GET(), GET()]);
    const first = await a.json();
    const second = await b.json();
    assert.equal(first.status, 'could_not_look');
    assert.deepEqual(first.backends, []);
    assert.equal(first.attempts, 'none not_configured');
    assert.equal(second.checkedAt, first.checkedAt, 'the second caller shared the first probe');
    const third = await (await GET()).json();
    assert.equal(third.cached, true);
    assert.equal(third.checkedAt, first.checkedAt);
  } finally {
    for (const [k, v] of saved) if (v !== undefined) process.env[k!] = v;
  }
});
