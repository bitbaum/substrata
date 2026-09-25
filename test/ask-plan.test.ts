/**
 * Ask's latency budget, as tests: the lookups a page question obviously needs
 * are made before the model is called, so a page question costs one model call
 * (two at most), and the exposure answer carries tickers with the correct
 * listed-vs-parent status. Measured live before this existed (2026-09-25):
 * 9-33 s to first text, answers from 2-4 model calls, Hitachi Energy called
 * "listed", citations as 【/path】.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planLookups, bottleneckIn } from '../lib/chat-agent/plan';
import { runAgent, type AgentEvent } from '../lib/chat-agent/loop';
import type { ModelTurn } from '../lib/chat-agent/turn';
import { tidyAnswer } from '../lib/chat-agent/parse';
import { readerContext } from '../lib/chat-context';
import { runTool } from '../lib/chat-tools/registry';
import { emptyLedger } from '../lib/chat-tools/ledger';
import { listingLine } from '../lib/chat-tools/exposure';

const leads = async () => [];

/** A model that asks for a tool on every turn it is offered tools — the worst case. */
function greedyModel(log: { tools: boolean; system: string }[]): ModelTurn {
  return async ({ messages, tools, onText }) => {
    log.push({ tools: Boolean(tools?.length), system: String(messages[0].content) });
    if (tools?.length)
      return {
        text: '',
        calls: [{ name: 'list_bottlenecks', args: JSON.stringify({ limit: log.length }) }],
        model: 'groq/m',
      };
    onText('An answer.');
    return { text: 'An answer.', calls: [], model: 'groq/m' };
  };
}

async function ask(question: string, path: string) {
  const log: { tools: boolean; system: string }[] = [];
  const events: AgentEvent[] = [];
  await runAgent({
    question,
    history: [],
    context: readerContext({ path }),
    turn: greedyModel(log),
    env: { leads },
    emit: (e) => events.push(e),
  });
  const done = events.find((e) => e.type === 'done');
  assert.ok(done && done.type === 'done', 'the question was answered');
  return { log, events, data: done.data };
}

const MEASURED = [
  ['Who makes EUV scanners and how well sourced is that?', '/bottlenecks/euv-lithography-scanners'],
  ['What is new on gallium export controls?', '/bottlenecks/gallium-refined'],
  ['Which listed companies are exposed to transformer lead times?', '/exposure'],
] as const;

test('the three measured questions are each answered by ONE model call, with no tools offered', async () => {
  for (const [question, path] of MEASURED) {
    const { log, data } = await ask(question, path);
    assert.equal(log.length, 1, `${question}: one model call`);
    assert.equal(log[0].tools, false, `${question}: the lookups were already made`);
    assert.equal(data.timing?.calls, 1);
  }
});

test('any page question costs at most two model calls, even for a model that always wants more', async () => {
  const pages = [
    ['What changed recently here?', '/bottlenecks/gallium-refined'],
    [
      'Compare this with the other lithography bottlenecks',
      '/bottlenecks/euv-lithography-scanners',
    ],
    ['Why does this matter for AI chips?', '/bottlenecks/euv-lithography-scanners'],
    ['What does ASML depend on?', '/markets/asml'],
    ['Tell me about the tickers here', '/exposure'],
  ];
  for (const [question, path] of pages) {
    const { log } = await ask(question, path);
    assert.ok(log.length <= 2, `${question} on ${path}: ${log.length} model calls`);
  }
});

test('the planner looks up leads for news and exposure for listings, never the web', () => {
  const gallium = planLookups(
    'What is new on gallium export controls?',
    readerContext({ path: '/bottlenecks/gallium-refined' }),
    { leads },
  );
  assert.deepEqual(
    gallium.calls.map((c) => c.name),
    ['recent_leads'],
  );
  const exposure = planLookups(
    'Which listed companies are exposed to transformer lead times?',
    readerContext({ path: '/exposure' }),
    { leads },
  );
  assert.equal(bottleneckIn('transformer lead times')?.slug, 'large-power-transformer-slots');
  assert.ok(exposure.calls.some((c) => c.name === 'listed_exposure'));
  assert.ok(exposure.confident);
  for (const [q, p] of MEASURED)
    assert.ok(
      !planLookups(q, readerContext({ path: p }), { leads }).calls.some(
        (c) => c.name === 'web_search',
      ),
    );
});

test('the exposure tool says Hitachi Energy trades only through its parent, with tickers', async () => {
  const { result } = await runTool(
    'listed_exposure',
    JSON.stringify({ bottleneck: 'Large power transformer slots' }),
    { ledger: emptyLedger() },
  );
  const data = JSON.parse(result);
  const hitachi = data.holders.find((h: { company: string }) => h.company === 'Hitachi Energy');
  assert.ok(hitachi, 'Hitachi Energy holds transformer slots');
  assert.match(hitachi.listing, /^NOT listed itself — its parent Hitachi is listed: 6501 JP/);
  const mitsubishi = data.holders.find(
    (h: { company: string }) => h.company === 'Mitsubishi Electric',
  );
  assert.equal(mitsubishi?.listing, 'Listed: 6503 JP');
  assert.ok(Array.isArray(data.companies_resting_on_it));
});

test('listing lines for every status', () => {
  assert.equal(listingLine(null), 'Listing not looked up (no directory page)');
  assert.equal(
    listingLine({ status: 'private', note: 'x', checkedOn: '2026-09-24' }),
    'Private — no listed shares',
  );
  assert.equal(
    listingLine({ status: 'none-found', query: 'x', checkedOn: '2026-09-24' }),
    'No listing found',
  );
});

test('training-format citation markers become markdown links, or go', () => {
  assert.equal(
    tidyAnswer('Only Anthropic depends on it【/bottlenecks/large-power-transformer-slots】.'),
    'Only Anthropic depends on it ([Large power transformer slots](/bottlenecks/large-power-transformer-slots)).',
  );
  assert.equal(
    tidyAnswer('Per ASML【https://www.asml.com/en/products】 and 【3†L1-L4】 [W1]【W2】.'),
    'Per ASML ([source](https://www.asml.com/en/products)) and [W1] [W2].',
  );
});
