/**
 * The chat-review loop: every Ask turn is logged, the day's conversations
 * export in chatkit's ChatTranscript shape, and only the shared token reads
 * them. The owner's "nothing in our database" answer was invisible until he
 * said so; these keep the log that makes it visible.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chatTurnLog, uuidOrNull, type TurnRow } from '../lib/chat-review/log';
import {
  bearerMatches,
  exportWindow,
  transcriptsOf,
  MAX_CONVERSATIONS,
  MAX_TURNS,
  MAX_TURN_CHARS,
  type StoredTurn,
} from '../lib/chat-review/export';
import { feedbackSchema } from '../lib/chat-review/feedback';
import { assistantScope, ASSISTANT_ROLE } from '../lib/chat-agent/prompt';

const CONV = '11111111-2222-4333-8444-555555555555';
const MSG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function collect() {
  const rows: TurnRow[] = [];
  return { rows, write: async (row: TurnRow) => void rows.push(row) };
}

test('a question is logged at once; the answer with its steps when the loop ends', async () => {
  const { rows, write } = collect();
  const log = chatTurnLog({
    conversationId: CONV,
    messageId: MSG,
    question: 'Who makes EUV scanners?',
    surface: '/markets/asml',
    write,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, 'user');
  assert.equal(rows[0].conversationId, CONV);
  assert.equal(rows[0].surface, '/markets/asml');
  log.observe({ type: 'status', text: 'Reading ASML…' });
  log.observe({ type: 'tool', label: 'Reading the ASML record' });
  log.observe({ type: 'tool', label: 'Reading the ASML record' });
  log.observe({ type: 'delta', text: 'ASML' });
  log.observe({
    type: 'done',
    data: {
      answer: 'ASML makes them.',
      sources: [],
      web: [],
      leads: [],
      followUps: [],
      trail: [],
      outside: false,
    },
  });
  log.observe({
    type: 'done',
    data: {
      answer: 'again',
      sources: [],
      web: [],
      leads: [],
      followUps: [],
      trail: [],
      outside: false,
    },
  });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(rows.length, 2, 'one answer row, never a second');
  assert.equal(rows[1].id, MSG);
  assert.equal(rows[1].role, 'assistant');
  assert.equal(rows[1].content, 'ASML makes them.');
  assert.deepEqual(rows[1].steps, ['Reading ASML…', 'Reading the ASML record']);
  assert.equal(rows[1].failed, false);
});

test('a failed turn is logged as failed, with the words the reader saw', async () => {
  const { rows, write } = collect();
  const log = chatTurnLog({
    conversationId: null,
    messageId: null,
    question: 'x',
    surface: undefined,
    write,
  });
  log.observe({ type: 'error', error: 'The assistant could not reach a model just now.' });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(rows[1].failed, true);
  assert.match(rows[1].content, /could not reach/);
  assert.equal(rows[1].surface, '/chat');
  assert.ok(uuidOrNull(rows[1].conversationId), 'a missing thread id is minted, never blank');
});

test('only a uuid is taken as a thread or message id', () => {
  assert.equal(uuidOrNull(CONV.toUpperCase()), CONV);
  assert.equal(uuidOrNull('reader@example.com'), null);
  assert.equal(uuidOrNull(42), null);
});

test('the export groups turns by conversation, newest first, bounded on every axis', () => {
  const at = (i: number) => new Date(Date.UTC(2026, 9, 22, 0, 0, i));
  const turn = (
    conv: string,
    i: number,
    role: 'user' | 'assistant',
    extra: Partial<StoredTurn> = {},
  ): StoredTurn => ({
    id: `${conv.slice(0, 8)}-0000-4000-8000-${String(i).padStart(12, '0')}`,
    conversation_id: conv,
    role,
    content: `turn ${i}`,
    steps: [],
    surface: '/chat',
    failed: false,
    created_at: at(i),
    ...extra,
  });
  const older = '00000000-0000-4000-8000-000000000001';
  const newer = '00000000-0000-4000-8000-000000000002';
  const turns: StoredTurn[] = [
    turn(older, 1, 'user'),
    turn(older, 2, 'assistant', {
      steps: ['Thinking…', 'Searching the web'],
      content: 'x'.repeat(5000),
    }),
    ...Array.from({ length: MAX_TURNS + 6 }, (_, i) =>
      turn(newer, 10 + i, i % 2 ? 'assistant' : 'user'),
    ),
    turn(newer, 99, 'assistant', { failed: true }),
  ];
  const out = transcriptsOf(turns, [
    {
      conversation_id: older,
      message_id: MSG,
      verdict: 'down',
      reason: 'dead_end',
      text: 'no way forward',
    },
  ]);
  assert.deepEqual(
    out.map((t) => t.id),
    [newer, older],
  );
  assert.equal(out[0].turns.length, MAX_TURNS);
  assert.equal(out[0].turns.at(-1)?.failed, true, 'the latest turns are kept');
  assert.equal(out[0].at, at(99).toISOString());
  assert.equal(out[0].feedback, undefined);
  assert.equal(out[1].turns[1].content.length, MAX_TURN_CHARS);
  assert.deepEqual(out[1].turns[1].steps, ['Thinking…', 'Searching the web']);
  assert.equal(out[1].turns[0].steps, undefined, 'no empty steps arrays');
  assert.deepEqual(out[1].feedback, [
    { messageId: MSG, verdict: 'down', reason: 'dead_end', text: 'no way forward' },
  ]);
  for (const t of out)
    for (const k of Object.keys(t))
      assert.ok(['id', 'at', 'surface', 'turns', 'feedback'].includes(k), `unexpected key ${k}`);
});

test('the window defaults to the last day and the limit is capped', () => {
  const w = exportWindow(new URLSearchParams('limit=500'));
  assert.equal(w.limit, MAX_CONVERSATIONS);
  assert.ok(Date.now() - w.since.getTime() > 23 * 3_600_000);
  const s = exportWindow(new URLSearchParams('since=2026-10-21T00:00:00Z&limit=5'));
  assert.equal(s.since.toISOString(), '2026-10-21T00:00:00.000Z');
  assert.equal(s.limit, 5);
  assert.equal(exportWindow(new URLSearchParams('since=yesterday')).since instanceof Date, true);
});

test('the bearer check takes the shared token only, and nothing while it is unset', () => {
  assert.equal(bearerMatches('Bearer abc', 'abc'), true);
  assert.equal(bearerMatches('bearer abc', 'abc'), true);
  assert.equal(bearerMatches('Bearer abd', 'abc'), false);
  assert.equal(bearerMatches('Bearer ab', 'abc'), false);
  assert.equal(bearerMatches(null, 'abc'), false);
  assert.equal(bearerMatches('Bearer ', ''), false);
  assert.equal(bearerMatches('Bearer abc', undefined), false);
});

test('feedback takes chatkit reasons and a bounded text, and nothing that names a person', () => {
  assert.equal(
    feedbackSchema.safeParse({ conversationId: CONV, messageId: MSG, verdict: 'up' }).success,
    true,
  );
  assert.equal(
    feedbackSchema.safeParse({
      conversationId: CONV,
      messageId: MSG,
      verdict: 'down',
      reason: 'dead_end',
      text: ' no ',
    }).data?.text,
    'no',
  );
  assert.equal(
    feedbackSchema.safeParse({ conversationId: CONV, messageId: MSG, verdict: 'meh' }).success,
    false,
  );
  assert.equal(
    feedbackSchema.safeParse({
      conversationId: CONV,
      messageId: MSG,
      verdict: 'down',
      reason: 'bad',
    }).success,
    false,
  );
  assert.equal(
    feedbackSchema.safeParse({ conversationId: 'me', messageId: MSG, verdict: 'up' }).success,
    false,
  );
  assert.equal(
    feedbackSchema.safeParse({
      conversationId: CONV,
      messageId: MSG,
      verdict: 'down',
      text: 'x'.repeat(1001),
    }).success,
    false,
  );
});

test('the review scope is read from the prompt and the tool registry, not typed twice', () => {
  const withWeb = assistantScope({ SEARXNG_URL: 'http://searx' } as unknown as NodeJS.ProcessEnv);
  const without = assistantScope({} as unknown as NodeJS.ProcessEnv);
  assert.ok(withWeb.startsWith("It is Substrata's research assistant. Substrata tracks"));
  assert.ok(ASSISTANT_ROLE.startsWith("You are Substrata's research assistant. Substrata tracks"));
  assert.match(withWeb, /search_corpus, get_bottleneck/);
  assert.match(withWeb, /web_search/);
  assert.doesNotMatch(without, /web_search/);
  assert.match(without, /Outside the corpus/);
  const sentences = withWeb.split(/(?<=\.)\s+(?=[A-Z])/).length;
  assert.ok(sentences >= 3 && sentences <= 6, `${sentences} sentences`);
});
