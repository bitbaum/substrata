/**
 * Ask never shows a tool call as its answer, and tools take the argument
 * names models actually use. Both seen live on 2026-10-02: three of twelve
 * questions "answered" with `TOOL: get_bottleneck / ARGS: {...}`, and Gemini's
 * `{"id": …}` ran get_bottleneck with no name ("Reading the  record").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runAgent, type AgentEvent } from '../lib/chat-agent/loop';
import { readTurn, tidyAnswer } from '../lib/chat-agent/parse';
import { readerContext } from '../lib/chat-context';
import { runTool } from '../lib/chat-tools/registry';
import { emptyLedger } from '../lib/chat-tools/ledger';
import { withAliases } from '../lib/chat-tools/tool';
import { BOTTLENECKS } from '../lib/bottlenecks';

const STRAY = 'TOOL: get_bottleneck\nARGS: {"name":"EUV lithography scanners"}';

test('a text tool call on a round without tools is reported, not returned as prose', () => {
  const read = readTurn(STRAY, [], false);
  assert.equal(read.text, '');
  assert.deepEqual(
    read.stray?.map((c) => c.name),
    ['get_bottleneck'],
  );
});

test('tidyAnswer never lets a TOOL/ARGS line reach the reader', () => {
  assert.equal(tidyAnswer(`Here it is.\n\n${STRAY}`), 'Here it is.');
});

test('a final round that asks for a tool gets it, once, and then writes', async () => {
  const events: AgentEvent[] = [];
  let calls = 0;
  await runAgent({
    question: 'Tell me something useful about chokepoints please',
    history: [],
    context: readerContext({}),
    env: {},
    emit: (e) => events.push(e),
    turn: async ({ tools }) => {
      calls++;
      if (tools) {
        // Keep asking while tools are offered, so the loop reaches its last round.
        return {
          text: '',
          calls: [{ name: 'list_bottlenecks', args: JSON.stringify({ limit: calls }) }],
          model: 'm',
        };
      }
      if (calls < 10 && !events.some((e) => e.type === 'tool' && /EUV/.test(e.label)))
        return {
          text: '',
          calls: [],
          stray: [{ name: 'get_bottleneck', args: '{"name":"EUV lithography scanners"}' }],
          model: 'm',
        };
      return { text: 'A real answer, in prose.', calls: [], model: 'm' };
    },
  });
  const done = events.find((e) => e.type === 'done') as Extract<AgentEvent, { type: 'done' }>;
  assert.ok(done, 'an answer was given');
  assert.equal(done.data.answer, 'A real answer, in prose.');
  assert.ok(
    events.some((e) => e.type === 'tool' && /EUV/.test(e.label)),
    'the stray lookup ran',
  );
});

test('an answer that never comes still names what was read, never a blank', async () => {
  const events: AgentEvent[] = [];
  await runAgent({
    question: 'Tell me something useful about chokepoints please',
    history: [],
    context: readerContext({}),
    env: {},
    emit: (e) => events.push(e),
    turn: async ({ tools }) =>
      tools
        ? {
            text: '',
            calls: [{ name: 'get_bottleneck', args: '{"name":"EUV lithography scanners"}' }],
            model: 'm',
          }
        : { text: '', calls: [], stray: [{ name: 'list_bottlenecks', args: '{}' }], model: 'm' },
  });
  const done = events.find((e) => e.type === 'done') as Extract<AgentEvent, { type: 'done' }>;
  assert.ok(done);
  assert.doesNotMatch(done.data.answer, /TOOL:/);
  assert.match(done.data.answer, /EUV lithography scanners/);
});

test('tools take the argument names models use', async () => {
  const params = { properties: { name: { type: 'string' } } };
  assert.deepEqual(withAliases(params, { id: 'asml' }), { id: 'asml', name: 'asml' });
  assert.deepEqual(
    withAliases(params, { name: 'x', id: 'y' }),
    { name: 'x', id: 'y' },
    'declared wins',
  );
  const slug = BOTTLENECKS[0].slug;
  const { label, result } = await runTool(
    'get_bottleneck',
    { id: slug },
    { ledger: emptyLedger() },
  );
  assert.match(label, new RegExp(slug));
  assert.equal(JSON.parse(result).error, undefined);
});

test('links nested inside links are mended to one link', async () => {
  const { unnestLinks } = await import('../lib/chat-agent/parse');
  assert.equal(
    unnestLinks('maker [Sourced]([/markets/asml](/markets/asml)).'),
    'maker [Sourced](/markets/asml).',
  );
  assert.equal(
    unnestLinks('see [Sourced]([/exposure?q=EUV%20x]).'),
    'see [Sourced](/exposure?q=EUV%20x).',
  );
  assert.equal(unnestLinks('[ASML](/markets/asml) stays'), '[ASML](/markets/asml) stays');
});
