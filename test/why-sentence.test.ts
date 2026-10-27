/** "Why it is here" is built from the evidence rows only, and never claims a chain role. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { universeEntries } from '../lib/universe/store';
import { whySentence } from '../lib/universe/why-sentence';

const tierB = universeEntries().filter((e) => e.tier === 'B');

test('a tier B sentence names its funds, its size and its identifiers, and no chain role', () => {
  assert.ok(tierB.length > 100);
  for (const e of tierB.slice(0, 200)) {
    const s = whySentence(e);
    assert.ok(s.length > 40, `${e.slug} has a sentence`);
    assert.match(s, /not a stated part of any supply chain/);
    assert.doesNotMatch(s, /supplier|producer|manufactur/i, e.slug);
    assert.ok(!/undefined|NaN|\[object/.test(s), `${e.slug}: ${s}`);
  }
});

test('the sentence quotes only what a row cites: a fund holder shows its fund', () => {
  const tesla = universeEntries().find((e) => e.slug === 'tesla')!;
  const s = whySentence(tesla);
  assert.match(s, /thematic fund/);
  assert.match(s, /\b(ARKQ|AIQ|BOTZ|DRIV)\b/);
  assert.match(s, /clears its floor/);
});

test('a tier A sentence leads with its hand-verified chain role', () => {
  const a = universeEntries().find((e) => e.slug === 'amd')!;
  assert.match(whySentence(a), /^Hand-verified role in a tracked chain/);
});
