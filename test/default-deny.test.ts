/**
 * Default deny (lib/chat-agent/default-deny.ts): with tool results in hand, a
 * sentence survives only when something stands behind it. A well-cited answer
 * must come through untouched; the live Chile sentence that mixed a made-up
 * claim with an honest clause loses the claim and nothing else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import recorded from './fixtures/kz-uranium-producers-in-2026-10-24.json';
import { defaultDeny, kindOf, type DenyContext } from '../lib/chat-agent/default-deny';
import { tableFactsIn } from '../lib/chat-agent/table-guard';

const facts = tableFactsIn(recorded.results)!;
const ctx: DenyContext = {
  question: recorded.question,
  summary: facts.summary,
  webCount: 3,
  evidence: `${recorded.results.join('\n')}\n[resource_production] {"display":"23,270 t","share":"38.6%"}`,
};
const asked = ['facilities', 'owners', 'buyers'] as const;

test('a well-cited answer comes through untouched', () => {
  const answer = [
    facts.summary.join(' '),
    '',
    '## Production',
    '',
    'Kazakhstan mined 23,270 t of uranium in 2024, 38.6% of world output, according to the [World Nuclear Association](/resources/uranium).',
    'The table below lists every venture with its owners as printed.',
    '',
    '```chat_ui',
    '{"type":"chart","chart":"bars","caption":"x","rows":[{"label":"Kazakhstan","value":23270}]}',
    '```',
    '',
    '## Who buys it',
    '',
    "The buyers of Kazakhstan's uranium output are not in our sources. A source that would settle it: offtake agreements in the producers' annual reports.",
    '',
    '### Unchecked web leads',
    '',
    'These are unchecked web pages, not part of the corpus:',
    '- [W1] [China and Kazakh uranium](https://example.org/a) — reports that China is the largest buyer.',
    '- A page says Kazatomprom signed long-term contracts with utilities [W2].',
    '',
    'If you have offtake contracts, you can send evidence to get them tracked.',
  ].join('\n');
  const out = defaultDeny(answer, ctx);
  assert.deepEqual(out.dropped, []);
  assert.equal(out.answer, answer);
});

test('the live Chile sentence: the made-up claim goes, the honest clause stays', () => {
  const s =
    'Outside the corpus — Many Chilean brine producers have long-term supply agreements with various battery manufacturers and trading companies; however, these specific buyer relationships are not tracked in the Substrata records provided. You can send evidence to get it tracked.';
  const out = defaultDeny(s, { ...ctx, question: 'Who buys Chile’s lithium?' });
  assert.equal(
    out.answer,
    'These specific buyer relationships are not tracked in the Substrata records provided. You can send evidence to get it tracked.',
  );
});

test('nothing stands behind it: uncited claims, figures from nowhere, gaps nobody asked for', () => {
  for (const s of [
    'Kazatomprom is the world’s largest uranium producer.',
    'Most Kazakh uranium goes to China under long-term contracts.',
    'Kazakhstan exported 21,000 t in 2024, according to customs data.',
  ])
    assert.equal(kindOf(s, ctx, [...asked]), null, s);
  // Russia was asked who produces, not who buys: a buyers gap is not its to add.
  assert.equal(
    kindOf('The sources do not list any buyers for this output.', ctx, ['facilities']),
    null,
  );
  assert.equal(
    kindOf('A customs filing would settle who purchases the material.', ctx, ['facilities']),
    null,
  );
});

test('each recognised kind is recognised', () => {
  const cases: [string, string][] = [
    [facts.summary[1], 'summary'],
    ['Kazakhstan mined 23,270 t in 2024 (Sourced).', 'figure with its source'],
    ["The buyers of Kazakhstan's uranium output are not in our sources.", 'gap'],
    ['A source that would settle it: offtake agreements.', 'what would settle it'],
    ['Capacity is capacity, not production.', 'capacity caveat'],
    ['These are unchecked web pages, not part of the corpus:', 'lead heading'],
    ['You can send evidence to get it tracked.', 'evidence invitation'],
    ['The full details appear in the table below.', 'transition'],
    ['What the sources say', 'transition'],
    ['See [Kazakhstan](/world/kz).', 'cited'],
  ];
  for (const [s, kind] of cases) assert.equal(kindOf(s, ctx, [...asked]), kind, s);
  // A [W#] for a page the lookups never fetched cites nothing.
  assert.equal(kindOf('China buys most of it [W9].', ctx, [...asked]), null);
});

test('a section whose source line carries a link cites its list', () => {
  const answer = [
    '## What the sources say',
    '- OAO Apatit operates the Lovozerskoye mines.',
    '- Source: [USGS Minerals Yearbook 2022](https://pubs.usgs.gov/myb/vol3/2022/myb3-2022-russia.pdf)',
  ].join('\n');
  assert.deepEqual(defaultDeny(answer, ctx).dropped, []);
});

test('what a cut leaves behind is tidied: pointers, unmatched brackets, a lone emphasis mark', () => {
  const answer = [
    'Capacity is capacity, not production. See the table below',
    '',
    'Nickel (2022) See the table below',
    '',
    '*(Note: USGS prints no capacity for either row, and capacity is not production.',
    '',
    'The full details appear in the table below).',
  ].join('\n');
  assert.equal(
    defaultDeny(answer, ctx).answer,
    [
      'Capacity is capacity, not production.',
      '',
      'Note: USGS prints no capacity for either row, and capacity is not production.',
      '',
      'The full details appear in the table below.',
    ].join('\n'),
  );
});
