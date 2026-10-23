/**
 * "Thought for 4s › Read 3 records" above an answer: what the assistant did,
 * as chatkit's thought row, in place of a stray "3 records read" line under
 * it. The trail comes first, the records read are one step, and an answer
 * that did nothing draws no row at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thinkingFor } from '../components/portal/chat/thinking';
import type { Turn } from '../components/portal/chat/types';

const source = (id: string, title: string): NonNullable<Turn['sources']>[number] => ({
  number: 1,
  id,
  title,
  href: `/markets/${id}`,
  evidence: 'Sourced',
  primary: [],
  kind: 'company',
});

test('the trail, then "Read N records", with the time it took', () => {
  const t = thinkingFor({
    id: 'a',
    role: 'assistant',
    content: '…',
    trail: ['Looking up ASML', 'Reading listings and exposure for ASML'],
    sources: [source('asml', 'ASML'), source('zeiss', 'Zeiss'), source('cymer', 'Cymer')],
    durationMs: 4200,
  });
  assert.ok(t);
  assert.equal(t.durationMs, 4200);
  assert.deepEqual(
    t.steps?.map((s) => s.label),
    ['Looking up ASML', 'Reading listings and exposure for ASML', 'Read 3 records'],
  );
  assert.equal(t.steps?.at(-1)?.detail, 'ASML · Zeiss · Cymer');
});

test('one record is singular; nothing done is no row', () => {
  const one = thinkingFor({
    id: 'a',
    role: 'assistant',
    content: '…',
    sources: [source('asml', 'ASML')],
  });
  assert.equal(one?.steps?.[0]?.label, 'Read 1 record');
  assert.equal(thinkingFor({ id: 'a', role: 'assistant', content: '…' }), undefined);
  assert.equal(thinkingFor({ id: 'u', role: 'user', content: 'hi', trail: ['x'] }), undefined);
});
