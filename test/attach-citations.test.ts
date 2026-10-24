/**
 * Code-attached citations (lib/chat-agent/attach-citations.ts): a sentence one
 * row vouches for — every name and figure in it is in that row — gets the
 * row's link, and so survives default deny. Anything else gets nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import recorded from './fixtures/ru-rare-earth-nickel-producers-in-2026-10-24.json';
import { attachCitations, rowFor, rowsIn } from '../lib/chat-agent/attach-citations';

const rows = rowsIn(recorded.results);
const USGS = 'https://pubs.usgs.gov/myb/vol3/2022/myb3-2022-russia.pdf';

test('a sentence every name and figure of which is in one row gets that row’s source', () => {
  for (const s of [
    'Nornickel runs mines in Murmansk Oblast and in Norilsk region.',
    'The capacity printed for the Murmansk Oblast mines is 300000 metric tons.',
    'OAO Apatit mines the Lovozerskoye deposit on the Kola Peninsula.',
  ])
    assert.equal(rowFor(s, rows)?.href, USGS, s);
  const out = attachCitations(
    'OAO Apatit mines the Lovozerskoye deposit on the Kola Peninsula.',
    recorded.results,
  );
  assert.match(out, /Kola Peninsula \(\[[^\]]+\]\(https:\/\/pubs\.usgs\.gov\/[^)]+\)\)\.$/);
});

test('nothing is attached where no single row vouches for it', () => {
  for (const s of [
    'OAO Apatit sells its concentrate to China.', // China is in no row
    'Nornickel is the largest nickel producer in the world.', // generalises
    'Nornickel mines 450000 metric tons a year in Murmansk Oblast.', // a figure from nowhere
    'Capacity is capacity, not production.', // names nothing, gives no figure
    'Rare earths', // a title
  ])
    assert.equal(rowFor(s, rows), null, s);
  assert.equal(
    attachCitations('Nornickel is the largest nickel producer in the world.', recorded.results),
    'Nornickel is the largest nickel producer in the world.',
  );
  // A computed sentence is the code's own: never re-cited.
  const summary = 'Operators, as printed: OAO Apatit.';
  assert.equal(attachCitations(summary, recorded.results, [summary]), summary);
});
