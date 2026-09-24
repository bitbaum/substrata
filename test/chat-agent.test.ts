/**
 * Ask as an assistant: the tools it can call, the context it is given, the
 * stream it shows, and the honest fallback when no model will answer.
 *
 * Everything here runs without a model, a database or a network — the model
 * seam (`ModelTurn`) and the lead/web lookups are injected.
 */
import { test } from 'node:test';
import { parseFollows } from '../lib/follows';
import assert from 'node:assert/strict';
import { ChainExhaustedError, type Link } from '@bitbaum/ai-kit';

import { CHAT_TOOLS, fitResult, runTool, toolDefinitions } from '../lib/chat-tools/registry';
import { emptyLedger, type ToolEnv } from '../lib/chat-tools/ledger';
import { findBottleneck, findCompany } from '../lib/chat-tools/resolve';
import { describeContext, preloadPage, readerContext, sectionOf } from '../lib/chat-context';
import { StreamGate, couldBeProtocol } from '../lib/chat-agent/stream-gate';
import { readTurn, stripThinking, tidyAnswer } from '../lib/chat-agent/parse';
import type { ModelTurn } from '../lib/chat-agent/turn';
import { systemPrompt } from '../lib/chat-agent/prompt';
import { budgetMessage, isPageRecord, runAgent, type AgentEvent } from '../lib/chat-agent/loop';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { MARKET_PARTICIPANTS } from '../lib/participants';

const envWith = (extra: Partial<ToolEnv> = {}): ToolEnv => ({ ledger: emptyLedger(), ...extra });
const someBottleneck = BOTTLENECKS.find((b) => b.producers.length > 0) ?? BOTTLENECKS[0];
const someCompany = MARKET_PARTICIPANTS[0];

// --- tool definitions --------------------------------------------------------

test('every tool is a well-formed OpenAI function with a unique name', () => {
  const defs = toolDefinitions(
    envWith({ leads: async () => [], web: async () => ({ status: 'off' }) }),
  );
  const names = defs.map((d) => d.function.name);
  assert.equal(new Set(names).size, names.length, 'tool names must be unique');
  assert.equal(defs.length, CHAT_TOOLS.length, 'with every backend present, every tool is offered');
  for (const def of defs) {
    assert.equal(def.type, 'function');
    assert.match(def.function.name, /^[a-z_]+$/);
    assert.ok(
      def.function.description.length > 30,
      `${def.function.name} needs a real description`,
    );
    const params = def.function.parameters as {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    assert.equal(params.type, 'object');
    for (const key of params.required ?? [])
      assert.ok(
        params.properties?.[key],
        `${def.function.name}: required "${key}" is not a property`,
      );
  }
});

test('a tool the deployment cannot run is not offered', () => {
  const names = toolDefinitions(envWith()).map((d) => d.function.name);
  assert.ok(!names.includes('recent_leads'), 'no database, no lead tool');
  assert.ok(!names.includes('web_search'), 'no search backend, no web tool');
  assert.ok(names.includes('get_bottleneck') && names.includes('search_corpus'));
});

// --- tool execution ------------------------------------------------------------

test('get_bottleneck returns the page, producers with their evidence state, and records it', async () => {
  const env = envWith();
  const { result } = await runTool(
    'get_bottleneck',
    JSON.stringify({ name: someBottleneck.name }),
    env,
  );
  const data = JSON.parse(result);
  assert.equal(data.page, `/bottlenecks/${someBottleneck.slug}`);
  assert.match(data.assessment.status, /judgement/i, 'a score is labelled as judgement');
  for (const p of data.producers)
    assert.ok(['Sourced', 'Candidate source', 'Unverified lead'].includes(p.status), p.status);
  assert.ok(env.ledger.records.has(`/bottlenecks/${someBottleneck.slug}`));
  assert.equal(env.ledger.trail.length, 1);
});

test('lookups tolerate the names a model actually types', () => {
  assert.equal(findBottleneck(someBottleneck.name.toUpperCase())?.slug, someBottleneck.slug);
  assert.equal(findBottleneck(someBottleneck.slug)?.slug, someBottleneck.slug);
  assert.equal(findCompany(someCompany.name.toLowerCase())?.slug, someCompany.slug);
  assert.equal(findCompany('zzz no such company'), undefined);
});

test('an unknown company comes back as a usable miss, not a throw', async () => {
  const { result } = await runTool(
    'get_company',
    { name: 'Totally Invented Widgets GmbH' },
    envWith(),
  );
  assert.match(JSON.parse(result).error, /not in the corpus/);
});

test('an unknown tool or malformed arguments never throw', async () => {
  assert.match((await runTool('drop_tables', '{}', envWith())).result, /No tool called/);
  const { result } = await runTool('get_bottleneck', '{not json', envWith());
  assert.ok(JSON.parse(result).error, 'empty args resolve to a miss the model can read');
});

test('sweep leads are labelled unreviewed and default to the reader rails', async () => {
  let asked: string[] | undefined;
  const env = envWith({
    rails: ['Gallium'],
    leads: async (q) => {
      asked = q.bottlenecks;
      return [
        {
          bottleneck: 'Gallium',
          url: 'https://example.org/story',
          title: 'Export licence change',
          published: null,
          excerpt: 'Licences tightened.',
          effectGuess: 'tightens',
          foundAt: '2026-09-20T10:00:00.000Z',
          verdict: null,
        },
      ];
    },
  });
  const data = JSON.parse((await runTool('recent_leads', {}, env)).result);
  assert.deepEqual(asked, ['Gallium']);
  assert.match(data.leads[0].status, /UNREVIEWED/);
  assert.equal(env.ledger.leads.length, 1, 'leads are kept apart from records');
  assert.equal(env.ledger.records.size, 0);
});

test('web results are fenced as unchecked and numbered for [W#] citation', async () => {
  const env = envWith({
    web: async () => ({
      status: 'found',
      findings: [{ title: 'A page', url: 'https://example.org/a', excerpt: 'text' }],
    }),
  });
  const data = JSON.parse((await runTool('web_search', { query: 'gallium' }, env)).result);
  assert.match(data.warning, /UNCHECKED/);
  assert.equal(data.results[0].cite_as, 'W1');
  assert.equal(env.ledger.web.length, 1);
});

// --- context assembly ------------------------------------------------------------

test('the page under the reader resolves to its record and is pre-loaded', async () => {
  const context = readerContext({ path: `/bottlenecks/${someBottleneck.slug}` });
  assert.equal(context.entity?.kind, 'bottleneck');
  assert.equal(context.entity?.name, someBottleneck.name);
  const pre = await preloadPage(context, {});
  assert.ok(pre, 'a record page is pre-loaded');
  assert.match(pre.text, new RegExp(`/bottlenecks/${someBottleneck.slug}`));
  assert.equal(pre.ledger.trail.length, 0, 'pre-loading is not something the reader asked for');
  assert.ok(pre.ledger.records.has(`/bottlenecks/${someBottleneck.slug}`));
  assert.match(describeContext(context), /Resolve "this"/);
});

test('a page that is not a record still says where the reader is', () => {
  assert.match(sectionOf('/account') ?? '', /desk/);
  const context = readerContext({ path: '/account?saved=1' });
  assert.equal(context.entity, undefined);
  assert.match(describeContext(context), /desk/);
  assert.match(describeContext(context), /not signed in/);
});

test('a signed-in reader brings their follows and the rails they reach', () => {
  const tech = someBottleneck.technologies[0];
  const context = readerContext({
    path: '/chat',
    follows: parseFollows({
      technologies: tech ? [tech] : [],
      companies: [someCompany.slug],
      kind: 'individual',
    }),
  });
  assert.ok(context.reader);
  assert.ok(context.reader.rails.length > 0);
  assert.ok(context.reader.companies.includes(someCompany.name));
  const text = describeContext(context);
  assert.match(text, /signed in and follows/);
  assert.match(text, /rails/);
});

test('following nothing yet means every bottleneck, said as such', () => {
  const context = readerContext({
    follows: parseFollows({}),
  });
  assert.equal(context.reader?.everything, true);
  assert.equal(context.reader?.rails.length, BOTTLENECKS.length);
  assert.match(describeContext(context), /follows nothing yet/);
});

test('the system prompt carries the context, the record and the honesty rules', () => {
  const context = readerContext({ path: `/markets/${someCompany.slug}` });
  const prompt = systemPrompt({
    context,
    preloaded: '{"name":"X"}',
    tools: toolDefinitions(envWith()),
    today: '2026-09-24',
  });
  assert.match(prompt, /2026-09-24/);
  assert.match(prompt, new RegExp(someCompany.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt, /already looked up/);
  assert.match(prompt, /UNREVIEWED/);
  assert.match(prompt, /TOOL:/, 'the text protocol is offered for models without native calls');
});

test('a lookup of the page record is recognised, so it is not paid for twice', () => {
  const context = readerContext({ path: `/bottlenecks/${someBottleneck.slug}` });
  assert.equal(
    isPageRecord(
      { name: 'get_bottleneck', args: JSON.stringify({ name: someBottleneck.name }) },
      context,
    ),
    true,
  );
  assert.equal(isPageRecord({ name: 'get_company', args: '{"name":"x"}' }, context), false);
});

// --- the stream --------------------------------------------------------------------

function gateAll(chunks: string[]) {
  const gate = new StreamGate();
  let out = '';
  for (const c of chunks) out += gate.feed(c);
  out += gate.flush();
  return { out, gate };
}

test('prose streams through the gate unchanged', () => {
  const text = 'The answer is ASML.\n\n- Tool makers are listed\n- Args aside, it is sourced.';
  const { out } = gateAll(text.match(/.{1,3}/gs) ?? []);
  assert.equal(out, text);
});

test('a text-protocol tool call never reaches the screen', () => {
  const { out, gate } = gateAll(['TO', 'OL: get_', 'company\nARGS: {"name":"ASML"}']);
  assert.equal(out, '');
  assert.equal(gate.suppressed, true);
});

test('a reasoning preamble is withheld', () => {
  const { out } = gateAll(['<thi', 'nk>weighing it</th', 'ink>\nASML makes them.']);
  assert.equal(out, 'ASML makes them.');
  assert.equal(stripThinking('<think>x</think> Done.'), 'Done.');
});

test('the protocol prefix check holds only what could still become a call', () => {
  assert.equal(couldBeProtocol('TO'), true);
  assert.equal(couldBeProtocol('**AR'), true);
  assert.equal(couldBeProtocol('Tools like'), false);
  assert.equal(couldBeProtocol('The'), false);
});

test('a finished turn is read for calls in either protocol', () => {
  const text = readTurn('TOOL: get_company\nARGS: {"name":"ASML"}', [], true);
  assert.equal(text.calls[0]?.name, 'get_company');
  assert.equal(text.text, '');
  const native = readTurn('', [{ name: 'list_bottlenecks', args: '{}' }], true);
  assert.equal(native.calls[0]?.name, 'list_bottlenecks');
  assert.equal(
    readTurn('TOOL: get_company', [], false).calls.length,
    0,
    'no tools offered, no calls',
  );
});

test('broken links in an answer are repaired', () => {
  assert.equal(
    tidyAnswer('See [/bottlenecks/euv‑lithography‑scanners] and [ASML](/markets/asml).'),
    'See [/bottlenecks/euv-lithography-scanners](/bottlenecks/euv-lithography-scanners) and [ASML](/markets/asml).',
  );
});

// --- the loop ----------------------------------------------------------------------

const link = { provider: { id: 'groq' }, model: 'm' } as unknown as Link;

test('the loop calls a tool, feeds the result back, and answers with its records', async () => {
  const events: AgentEvent[] = [];
  let round = 0;
  const seen: string[] = [];
  const turn: ModelTurn = async ({ messages, onText }) => {
    round += 1;
    seen.push(String(messages.at(-1)?.content));
    if (round === 1) {
      onText('Let me check. ');
      return {
        text: 'Let me check.',
        calls: [{ name: 'get_company', args: JSON.stringify({ name: someCompany.name }) }],
        model: 'groq/m',
      };
    }
    onText(`${someCompany.name} is recorded.`);
    return { text: `${someCompany.name} is recorded.`, calls: [], model: 'groq/m' };
  };
  await runAgent({
    question: 'Who is this?',
    history: [],
    context: readerContext({}),
    turn,
    env: {},
    emit: (e) => events.push(e),
  });
  assert.equal(round, 2);
  assert.match(seen[1], /TOOL RESULTS/);
  assert.ok(
    events.some((e) => e.type === 'reset'),
    'prose before a tool call is withdrawn',
  );
  assert.ok(events.some((e) => e.type === 'tool'));
  const done = events.find((e) => e.type === 'done');
  assert.ok(done && done.type === 'done');
  assert.equal(done.data.sources[0]?.href, `/markets/${someCompany.slug}`);
  assert.equal(done.data.trail.length, 1);
  assert.equal(done.data.model, 'groq/m');
});

test('a spent daily budget is said plainly, with the records already read', async () => {
  const events: AgentEvent[] = [];
  const turn: ModelTurn = async () => {
    throw new ChainExhaustedError([
      { link, message: 'groq/a: 429 daily — tokens per day' },
      { link, message: 'openrouter/b: 429 daily — free-models-per-day' },
    ]);
  };
  await runAgent({
    question: 'What is this?',
    history: [],
    context: readerContext({ path: `/bottlenecks/${someBottleneck.slug}` }),
    turn,
    env: {},
    emit: (e) => events.push(e),
  });
  const done = events.find((e) => e.type === 'done');
  assert.ok(done && done.type === 'done');
  assert.equal(done.data.degraded, true);
  assert.match(done.data.answer, /budget is used up/);
  assert.equal(done.data.sources[0]?.href, `/bottlenecks/${someBottleneck.slug}`);
});

test('a failure that is not a budget is an error, never a made-up answer', async () => {
  assert.equal(
    budgetMessage(new ChainExhaustedError([{ link, message: 'groq/a: 500 — boom' }])),
    undefined,
  );
  const events: AgentEvent[] = [];
  await runAgent({
    question: 'Anything?',
    history: [],
    context: readerContext({}),
    turn: async () => {
      throw new ChainExhaustedError([{ link, message: 'groq/a: 500 — boom' }]);
    },
    env: {},
    emit: (e) => events.push(e),
  });
  // A status line first (the reader sees it started), then the error.
  assert.deepEqual(
    events.map((e) => e.type),
    ['status', 'error'],
  );
});

test('an oversized tool result stays valid JSON and says it was cut', () => {
  const big = { rows: Array.from({ length: 400 }, (_, i) => ({ i, text: 'x'.repeat(40) })) };
  const text = fitResult(big, 3500);
  assert.ok(text.length <= 3500);
  const parsed = JSON.parse(text);
  assert.ok(parsed.rows.length >= 2 && parsed.rows.length < 400);
  assert.match(parsed.truncated, /left out/);
});
