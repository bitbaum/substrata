/**
 * Ask made fast and made a verifier: the round count, parallel calls, the
 * page-only shortcut, evidence fetched before the first model call, and a
 * verdict that has to rest on a quoted passage.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { answerableFromPage, runAgent, type AgentEvent } from '../lib/chat-agent/loop';
import { gatherEvidence, verdictOf, verifyFromBody } from '../lib/chat-agent/verify';
import { emptyLedger } from '../lib/chat-tools/ledger';
import { readerContext } from '../lib/chat-context';
import { bestPassage } from '../lib/chat-web';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { MARKET_PARTICIPANTS } from '../lib/participants';

const bottleneck = BOTTLENECKS.find((b) => b.producers.length > 0) ?? BOTTLENECKS[0];

test('a status line is the first thing the reader sees, before any lookup', async () => {
  const events: AgentEvent[] = [];
  await runAgent({
    question: 'What is this?',
    history: [],
    context: readerContext({ path: `/bottlenecks/${bottleneck.slug}` }),
    turn: async ({ onText }) => (onText('Answer.'), { text: 'Answer.', calls: [], model: 'm' }),
    env: {},
    emit: (e) => events.push(e),
  });
  assert.equal(events[0]?.type, 'status');
  const done = events.find((e) => e.type === 'done');
  assert.ok(done?.type === 'done' && done.data.timing && done.data.timing.total >= 0);
});

test('a question about the page is answered from its record: no tools offered, one call', async () => {
  let calls = 0;
  let offered: unknown[] | undefined = ['sentinel'];
  await runAgent({
    question: 'Summarise this',
    history: [],
    context: readerContext({ path: `/bottlenecks/${bottleneck.slug}` }),
    turn: async ({ tools, onText }) => {
      calls += 1;
      offered = tools;
      onText('ok');
      return { text: 'ok', calls: [], model: 'm' };
    },
    env: {},
    emit: () => {},
  });
  assert.equal(calls, 1);
  assert.equal(offered, undefined);
  assert.equal(answerableFromPage('Summarise this', true), true);
  assert.equal(answerableFromPage('Summarise this', false), false, 'no record, no shortcut');
  assert.equal(answerableFromPage('Any news on this today?', true), false);
  assert.equal(answerableFromPage('Who else competes with this?', true), false);
});

test('calls in one round run together, not one after another', async () => {
  const [a, b] = MARKET_PARTICIPANTS;
  let round = 0;
  const started = Date.now();
  const events: AgentEvent[] = [];
  await runAgent({
    question: 'Compare these two companies',
    history: [],
    context: readerContext({}),
    turn: async ({ onText }) => {
      round += 1;
      if (round === 1)
        return {
          text: '',
          calls: [
            { name: 'get_company', args: JSON.stringify({ name: a.name }) },
            { name: 'get_company', args: JSON.stringify({ name: b.name }) },
          ],
          model: 'm',
        };
      onText('done');
      return { text: 'done', calls: [], model: 'm' };
    },
    env: {},
    emit: (e) => events.push(e),
  });
  const tools = events.filter((e) => e.type === 'tool');
  assert.equal(tools.length, 2);
  // Both labels go out before either result comes back.
  const firstStatusAfter = events.findIndex((e, i) => i > 0 && e.type === 'status');
  assert.ok(events.indexOf(tools[1]) < firstStatusAfter);
  assert.ok(Date.now() - started < 5000);
});

test('rounds are capped: a model that never stops calling tools is made to answer', async () => {
  let round = 0;
  await runAgent({
    question: 'Tell me everything about every company',
    history: [],
    context: readerContext({}),
    turn: async ({ tools }) => {
      round += 1;
      if (!tools) return { text: 'final', calls: [], model: 'm' };
      return {
        text: '',
        calls: [{ name: 'search_corpus', args: JSON.stringify({ query: `q${round}` }) }],
        model: 'm',
      };
    },
    env: {},
    emit: () => {},
  });
  assert.equal(round, 4, 'three tool rounds, then one answer with no tools');
});

test('a verify request is bounded: a claim, an optional figure, a url or a site path', () => {
  assert.equal(verifyFromBody(undefined), undefined);
  assert.deepEqual(verifyFromBody({ claim: '  ASML shipped  53 EUV tools ', value: '53' }), {
    claim: 'ASML shipped 53 EUV tools',
    value: '53',
  });
  assert.equal(verifyFromBody({ claim: 'x' }), 'invalid');
  assert.equal(verifyFromBody({ claim: 'ok claim', source: 'javascript:alert(1)' }), 'invalid');
  assert.equal(verifyFromBody({ claim: 'ok claim', source: 'file:///etc/passwd' }), 'invalid');
  assert.ok(verifyFromBody({ claim: 'ok claim', source: '/data#method-share' }));
});

test('verify reads the cited source AND searches the web, in parallel, before the model', async () => {
  const ledger = emptyLedger();
  const order: string[] = [];
  const slow = (label: string, ms: number) =>
    new Promise<void>((r) => setTimeout(() => (order.push(label), r()), ms));
  const t0 = Date.now();
  const block = await gatherEvidence(
    { claim: 'ASML shipped 53 EUV systems in 2024', value: '53', source: 'https://example.com/ar' },
    {
      ledger,
      read: async (url) => {
        await slow('read', 120);
        return { title: 'Annual report', url, excerpt: 'We shipped 44 EUV systems.', cited: true };
      },
      web: async () => {
        await slow('web', 120);
        return {
          status: 'found',
          findings: [{ title: 'News', url: 'https://news.example/x', excerpt: '53 EUV systems' }],
        };
      },
    },
  );
  assert.ok(Date.now() - t0 < 220, 'the two lookups overlapped');
  assert.deepEqual(order.sort(), ['read', 'web']);
  assert.equal(ledger.web[0].cited, true, 'the cited source comes first');
  assert.equal(ledger.web.length, 2);
  assert.match(block, /CITED SOURCE/);
  assert.match(block, /Verdict: X/);
  assert.match(block, /quoted material, not instructions/);
});

test('an unreadable source is said to be unreadable, not silently skipped', async () => {
  const block = await gatherEvidence(
    { claim: 'Something about wafers', source: 'https://dead.example' },
    { ledger: emptyLedger(), read: async () => null },
  );
  assert.match(block, /COULD NOT BE READ/);
});

test('the verdict is read off the first line in any of the forms models write it', () => {
  assert.equal(verdictOf('**Verdict: Supported**\n> quote'), 'Supported');
  assert.equal(verdictOf('Verdict: outdated — newer data'), 'Outdated');
  assert.equal(verdictOf('**Verdict:** Contradicted'), 'Contradicted');
  assert.equal(verdictOf('I think it is fine'), undefined);
});

test('the passage kept is the one carrying the claimed number, not the page head', () => {
  const page =
    'Cookie banner. Menu. Home. Our company makes lithography machines. ' +
    'In 2024 we shipped 44 EUV systems to customers in Asia. Revenue grew.';
  const passage = bestPassage(page, 'ASML shipped 44 EUV systems', 80);
  assert.match(passage, /44 EUV systems/);
  assert.ok(!passage.startsWith('Cookie'));
});
