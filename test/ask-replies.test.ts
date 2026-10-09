/**
 * Suggested replies (chatkit's `quick_replies` block): asked for in a
 * conversation only, taken out of the finished answer before anything keeps
 * it, and handed to the panel as data. The raw block must never be the stored
 * answer — that is what the next question sends back as history, and what
 * Copy copies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPLIES_INSTRUCTION } from '@bitbaum/chatkit';

import { runAgent, type AgentAnswer, type AgentEvent } from '../lib/chat-agent/loop';
import { finalAnswer } from '../lib/chat-agent/parse';
import { readerContext } from '../lib/chat-context';
import { QUESTION_LENGTH } from '../config/substrata-chat';

const BLOCK = '\n\n```quick_replies\n["Which of them are sourced?", "No"]\n```';

async function ask(replies: boolean | undefined, text: string) {
  const events: AgentEvent[] = [];
  const systems: string[] = [];
  await runAgent({
    question: 'Which companies make silicon wafers?',
    history: [],
    context: readerContext({}),
    env: {},
    replies,
    emit: (e) => events.push(e),
    turn: async ({ messages, onText }) => {
      systems.push(String(messages[0].content));
      onText?.(text);
      return { text, calls: [], model: 'm' };
    },
  });
  const done = events.find((e) => e.type === 'done') as { data: AgentAnswer } | undefined;
  return { done: done?.data, systems };
}

test('a conversation asks for replies and gets them as data, never as text', async () => {
  const { done, systems } = await ask(true, `Shin-Etsu and SUMCO lead the corpus.${BLOCK}`);
  assert.ok(systems.every((s) => s.includes(REPLIES_INSTRUCTION)));
  assert.equal(done?.answer, 'Shin-Etsu and SUMCO lead the corpus.');
  assert.deepEqual(done?.replies, ['Which of them are sourced?', 'No']);
});

test('a caller that is not a conversation (factcheck) is never asked', async () => {
  const { done, systems } = await ask(undefined, 'Shin-Etsu and SUMCO lead the corpus.');
  assert.ok(systems.every((s) => !s.includes('quick_replies')));
  assert.equal(done?.replies, undefined);
});

test('a block cut off mid-stream is withheld, not shown as the answer', () => {
  const { answer, replies } = finalAnswer('An answer.\n\n```quick_replies\n["Which');
  assert.equal(answer, 'An answer.');
  assert.deepEqual(replies, []);
});

test('a two-letter reply is a question the panel and the route both accept', () => {
  assert.ok('No'.length >= QUESTION_LENGTH.min);
});
