/**
 * The reader's words only (lib/chat-agent/internal.ts): no tool or field name,
 * no reply to a send-back — and the send-backs themselves name none, so the
 * model is not invited to talk about them (turn.ts REVISION_RULE).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { internalProblem, withoutInternals } from '../lib/chat-agent/internal';
import { reviseUnsupported } from '../lib/chat-agent/grounding';
import { missingLinks, wallInstruction } from '../lib/chat-agent/ladder';
import { claimInstruction } from '../lib/chat-agent/table-guard';
import { REVISION_RULE, type ModelTurn } from '../lib/chat-agent/turn';
import { gapSentences, oneGapEach } from '../lib/chat-agent/uncited';

const russia = readFileSync(
  new URL('./fixtures/ask-live-ru-rare-earth-nickel-2026-10-24.md', import.meta.url),
  'utf8',
);
const INTERNAL =
  /producers_in|read_as|resource_production|`companies`|`display`|printed_once|send-back/;

test('a sentence that talks to the send-back, or names our machinery, is internal', () => {
  for (const s of [
    'You are right: the `producers_in` rows do carry the `companies` cells.',
    "I'm sorry for the confusion above.",
    'As you said, the owners are in the table.',
    'I summarized those out on the first pass.',
    'Rewriting below, quoting the printed cells.',
    '`read_as` splits this to operator = OAO Apatit.',
    'The resource_production lookup returned 23,270 t.',
  ])
    assert.ok(internalProblem(s), s);
  for (const s of [
    'Ownership of the plants is in the table below.',
    'Kazakhstan mined 23,270 t of uranium in 2024.',
    'The buyers of Kazakhstan’s uranium output are not in our sources.',
    'These companies operate the mines.',
  ])
    assert.equal(internalProblem(s), null, s);
});

test('the recorded Russia answer reaches the reader without our vocabulary', () => {
  assert.match(russia, /^You are right: the `producers_in` rows/);
  const out = withoutInternals(russia);
  assert.ok(!INTERNAL.test(out), out);
  assert.ok(!/you are right|rewriting below|first pass/i.test(out));
  for (const keep of ['OAO Apatit', 'PAO GMK Norilskiy Nickel (Nornickel)', '300000 metric tons'])
    assert.ok(out.includes(keep), keep);
  assert.match(out, /the USGS entry as printed: \*\*OAO Apatit\*\*/);
  // A chart or code block is left as it is.
  const fenced = '```chat_ui\n{"type":"chart"}\n```';
  assert.equal(withoutInternals(fenced), fenced);
});

test('no send-back names a tool or a field, and every one says how to rewrite', async () => {
  const kz = 'Which companies mine uranium in Kazakhstan, who owns them, and who do they sell to?';
  const wall = wallInstruction(
    { kind: 'denies', what: ['facilities', 'owners'] },
    missingLinks(kz, []),
  );
  const counts = claimInstruction(['17 ventures.'], ['The table has 17 rows.']);
  let figures = '';
  const turn: ModelTurn = async ({ messages }) => {
    figures = String(messages[messages.length - 1].content);
    return { text: 'ok', calls: [] } as never;
  };
  await reviseUnsupported({ messages: [], answer: 'x', figures: ['6 kt'], turn, onText: () => {} });
  for (const text of [wall, counts, figures]) {
    assert.ok(!INTERNAL.test(text), text);
    assert.ok(text.includes(REVISION_RULE), 'tells the model not to reply to the check');
  }
});

test('each missing link is said once, whatever the words', () => {
  const twice =
    "The buyers of Chile's lithium output are not in our sources. A source that would settle it: offtake records.\n\nThe buyers of Chile's output are not in our sources. A source that would settle it: customs records.\n\n### Unchecked web leads";
  const gaps = [{ box: 'buyers' } as Parameters<typeof oneGapEach>[1][number]];
  assert.equal(gapSentences(twice, 'buyers').length, 2);
  const once = oneGapEach(twice, gaps);
  assert.equal(gapSentences(once, 'buyers').length, 1);
  assert.ok(once.includes('offtake records') && !once.includes('customs records'));
  assert.ok(once.includes('### Unchecked web leads'));
});
