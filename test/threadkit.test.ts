import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canWrite, visibleMessages } from 'threadkit';
import { pageThread } from '../lib/page-thread';

test('page threads let a signed-in reader write and a public observer only read', () => {
  const thread = pageThread('/notes/demo', ['actor-1']);
  assert.equal(canWrite(thread, 'actor-1'), true);
  assert.equal(canWrite(thread, 'public'), false);
  const messages = [
    {
      id: '1',
      threadId: '/notes/demo',
      authorId: 'actor-1',
      body: 'A sourced correction.',
      createdAt: new Date(),
    },
  ];
  assert.equal(visibleMessages(thread, 'public', messages).length, 1);
});
