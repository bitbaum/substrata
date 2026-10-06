/**
 * Figures an answer gives must be in what it read. The cases are the real
 * answer of 2026-10-02 ("≈70% of capacity", ">80% of wafer output", neither
 * in any row) and the figures the checker must leave alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runAgent, type AgentEvent } from '../lib/chat-agent/loop';
import { readerContext } from '../lib/chat-context';
import { numbersIn, unsupportedFigures } from '../lib/chat-agent/grounding';

const EVIDENCE =
  'TOOL RESULTS: {"figure":"128 weeks, US, 2025-Q2","change":"up 6.7% from 120 weeks (2024)"} ' +
  '{"world_total":"900,000 kg (= 900 t)","top_producers":[{"country":"China","world_share":"100.0%"}]}';

test('numbers are read in one spelling: separators, decimals, units', () => {
  const n = numbersIn('900,000 kg, 13.1% and 2,061 GW');
  for (const v of ['900000', '13.1', '13', '2061']) assert.ok(n.has(v), v);
});

test('figures from nowhere are found; figures from the rows are not', () => {
  const answer =
    'A blockade would remove about 70% of leading-edge capacity, and Taiwan controls >80% of wafer output. Lead times are 128 weeks, up 6.7% from 120 weeks; China made 900,000 kg (900 t).';
  assert.deepEqual(unsupportedFigures(answer, EVIDENCE).sort(), ['70%', '80%']);
});

test('years, small counts, the reader’s own numbers and labelled background are left alone', () => {
  const answer =
    'Three points for 2025. 1. Lead times are 128 weeks. Outside the corpus — CoWoS has been in volume since 2012 with 65 nm interposers.';
  assert.deepEqual(unsupportedFigures(answer, EVIDENCE), []);
});

test('an answer with an invented figure is sent back once and the revision is what the reader gets', async () => {
  const events: AgentEvent[] = [];
  let calls = 0;
  await runAgent({
    question: 'Tell me something useful about chokepoints please',
    history: [],
    context: readerContext({}),
    env: {},
    emit: (e) => events.push(e),
    turn: async ({ tools, messages }) => {
      calls++;
      if (tools) return { text: 'About 70% of supply is lost.', calls: [], model: 'm' };
      const asked = String(messages.at(-1)?.content ?? '');
      assert.match(asked, /70%/, 'the revision names the unsupported figure');
      return { text: 'Supply would be lost; the rows give no share.', calls: [], model: 'm' };
    },
  });
  const done = events.find((e) => e.type === 'done') as Extract<AgentEvent, { type: 'done' }>;
  assert.equal(done.data.answer, 'Supply would be lost; the rows give no share.');
  assert.equal(calls, 2, 'one answer, one revision — never a loop');
});

test('an answer cut off at the output limit is finished, once, not shown cut', async () => {
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
      if (tools)
        return { text: 'ASML is listed as ASML NA and AS', calls: [], model: 'm', truncated: true };
      return { text: 'ML US.', calls: [], model: 'm' };
    },
  });
  const done = events.find((e) => e.type === 'done') as Extract<AgentEvent, { type: 'done' }>;
  assert.equal(done.data.answer, 'ASML is listed as ASML NA and ASML US.');
  assert.equal(calls, 2);
});

test('a revision that fails leaves the answer without the unsupported sentences', async () => {
  const { withoutSentencesHolding } = await import('../lib/chat-agent/grounding');
  assert.equal(
    withoutSentencesHolding(
      'Lead times are 128 weeks. About 70% is lost.\n- Taiwan holds 80% of it.\n- TSMC is listed.',
      ['70%', '80%'],
    ),
    'Lead times are 128 weeks.\n- TSMC is listed.',
  );
});

test('a number fused into a field name is evidence: net_pressure_90d allows "90-day"', () => {
  const evidence = '{"bottleneck":"HBM","net_pressure_90d":-1,"score_12":10}';
  assert.deepEqual(
    unsupportedFigures('A net 90-day pressure of -1, binding score 10/12.', evidence),
    [],
  );
  // The answer side stays strict: a figure from nowhere is still caught.
  assert.deepEqual(unsupportedFigures('Prices rose 45% this year.', evidence), ['45%']);
});
