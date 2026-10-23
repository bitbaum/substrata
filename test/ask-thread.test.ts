/**
 * Expand on the Ask panel hands the whole thread to /chat through the tab's
 * session store; the URL carries only the id. Nothing may be lost on the way,
 * and nothing that is not a handoff we wrote may come back as one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chatHref,
  isHandoff,
  isThreadId,
  loadThread,
  saveThread,
  threadKey,
  type ThreadHandoff,
} from '../lib/ask-thread';

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    size: () => m.size,
  };
}

const handoff: ThreadHandoff = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  conversationId: 'conv-1',
  topic: '',
  onPath: '/bottlenecks/euv-lithography-scanners',
  turns: [
    { id: 'u1', role: 'user', content: 'Who makes EUV scanners?' },
    {
      id: 'a1',
      role: 'assistant',
      content: 'Only ASML.',
      sources: [
        {
          number: 1,
          id: 'asml',
          title: 'ASML',
          href: '/markets/asml',
          evidence: 'Sourced',
          primary: [],
          kind: 'company',
        },
      ],
      trail: ['Looking up ASML'],
      replies: ['Who supplies them?'],
      durationMs: 4200,
    },
  ],
};

test('a thread comes back whole, under the same conversation id', () => {
  const store = memory();
  saveThread(handoff, store);
  assert.deepEqual(loadThread(handoff.id, store), handoff);
  assert.equal(chatHref(handoff.id), `/chat?thread=${handoff.id}`);
  assert.equal(threadKey(handoff.id), `substrata-ask-thread:${handoff.id}`);
});

test('only an id we minted is looked up; only a handoff we wrote comes back', () => {
  const store = memory();
  assert.equal(loadThread('../etc/passwd', store), null);
  assert.equal(loadThread('x', store), null);
  assert.ok(isThreadId(handoff.id));
  assert.ok(!isThreadId('/chat'));
  store.setItem(threadKey(handoff.id), '{"id":"' + handoff.id + '","turns":"no"}');
  assert.equal(loadThread(handoff.id, store), null);
  store.setItem(threadKey(handoff.id), 'not json');
  assert.equal(loadThread(handoff.id, store), null);
  assert.ok(!isHandoff({ ...handoff, turns: [{ id: 1 }] }));
  assert.ok(isHandoff(handoff));
});

test('a very long thread is cut to its recent turns, never refused', () => {
  const store = memory();
  const turns = Array.from({ length: 100 }, (_, i) => ({
    id: `t${i}`,
    role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
    content: `turn ${i}`,
  }));
  saveThread({ ...handoff, turns }, store);
  const back = loadThread(handoff.id, store);
  assert.ok(back);
  assert.equal(back.turns.length, 40);
  assert.equal(back.turns.at(-1)?.content, 'turn 99');
});
