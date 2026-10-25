/**
 * Research mode, whole runs (docs/architecture/2026-10-25-research-mode.md):
 * the five questions the owner's test set names, through `runAgent` with a
 * fake web and a fake model. Asserted: the shape (bottom line first, sections
 * in order when inputs exist), every figure traceable to the passage it cites,
 * scenario numbers written by code, uncited forecasts dropped, a gap filed for
 * each sub-question no page answered, and the budget (one plan call, one
 * writing call). Never the model's prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runAgent, type AgentAnswer, type AgentEvent } from '../lib/chat-agent/loop';
import { readerContext } from '../lib/chat-context';
import { opensWithCorpusGap } from '../lib/chat-agent/open-first';
import { webFigureProblems } from '../lib/chat-agent/web-figures';
import type { GapReport } from '../lib/chat-agent/gaps';
import type { ModelTurn } from '../lib/chat-agent/turn';
import type { WebFinding, WebLookup } from '../lib/chat-web';

const TODAY = '2026-10-25';

const page = (url: string, excerpt: string, published = '2026-03-01'): WebFinding => ({
  title: new URL(url).hostname,
  url,
  excerpt,
  published,
});

/** The neon pages, by the query the plan gives them. Prices: nothing found. */
const NEON: Record<string, WebFinding[]> = {
  'global neon supply 2025': [
    page(
      'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-neon.pdf',
      'U.S. apparent consumption of neon was estimated at 180 million liters in 2021 and 230 million liters in 2025.',
    ),
  ],
  'neon demand semiconductor lithography': [
    page(
      'https://www.gasworld.com/neon-demand',
      'Semiconductor manufacturing accounts for about 70% of global neon demand, mainly in excimer lasers for DUV lithography.',
    ),
  ],
  'neon supply Ukraine 2022 shortage recovery': [
    page(
      'https://www.reuters.com/technology/neon-ukraine',
      'Before 2022, Ukraine supplied about 50% of semiconductor-grade neon.',
    ),
  ],
  'neon price history': [],
  'electronic specialty gases market forecast 2030': [
    page(
      'https://www.techinsights.com/blog/specialty-gases',
      'TechInsights expects electronic specialty gases to grow 6.5% a year through 2030.',
    ),
  ],
};

const NEON_PLAN = {
  subject: 'neon',
  subQuestions: [
    { id: 'supply', ask: 'Current global supply and who', query: 'global neon supply 2025' },
    {
      id: 'drivers',
      ask: 'Demand drivers by end use',
      query: 'neon demand semiconductor lithography',
    },
    {
      id: 'risks',
      ask: 'Supply shock and recovery',
      query: 'neon supply Ukraine 2022 shortage recovery',
    },
    { id: 'prices', ask: 'Price history', query: 'neon price history' },
    {
      id: 'forecasts',
      ask: 'Published forecasts',
      query: 'electronic specialty gases market forecast 2030',
    },
  ],
  tools: [{ name: 'find_numbers', args: { query: 'neon' } }],
};

const SPEC = {
  measure: 'US apparent consumption of neon',
  unit: 'million liters',
  inputs: [
    { id: 'a', label: 'US apparent consumption, 2021', value: 180, year: 2021, cite: 'W1' },
    { id: 'b', label: 'US apparent consumption, 2025', value: 230, year: 2025, cite: 'W1' },
    { id: 'g', label: 'Specialty gases growth', value: 6.5, unit: '%', cite: 'W4' },
  ],
  start: 'b',
  horizon: 2030,
  cases: [
    { name: 'Low', rate: 'flat' },
    { name: 'Base', rate: 'cagr:a:b' },
    { name: 'High', rate: 'g' },
  ],
  assumptions: ['US use follows chipmaking'],
};

const NEON_ANSWER = [
  'Neon demand follows chipmaking: semiconductor manufacturing accounts for about 70% of global neon demand [W2].',
  '',
  '### What is established',
  'U.S. apparent consumption of neon was estimated at 180 million liters in 2021 and 230 million liters in 2025, according to [W1].',
  'Before 2022, Ukraine supplied about 50% of semiconductor-grade neon, according to [W3].',
  '',
  '### What drives it',
  'TechInsights expects electronic specialty gases to grow 6.5% a year through 2030, according to [W4].',
  'Demand will double by 2030.',
  '',
  '### Scenarios',
  'Reasoning, not a sourced forecast: the cases start from the latest cited level.',
  '```scenario',
  JSON.stringify(SPEC),
  '```',
  '',
  '### What would change this',
  'Reasoning, not a sourced forecast: watch wafer starts and the mix of DUV and EUV tools.',
  '',
  '### Confidence and gaps',
  'Reasoning, not a sourced forecast: moderate; the pages read give a national total, not a global one.',
].join('\n');

/** A fake model: the plan on the planning call, the answer on the writing call. */
function fakeTurn(plan: string, answer: string, calls: string[]): ModelTurn {
  return async ({ messages, onText }) => {
    const system = String(messages[0].content);
    if (/You plan research/.test(system)) {
      calls.push('plan');
      return { text: plan, calls: [], model: 'fake' };
    }
    calls.push('write');
    onText(answer);
    return { text: answer, calls: [], model: 'fake' };
  };
}

async function run(
  question: string,
  web: (q: string) => WebLookup,
  turn: ModelTurn,
): Promise<{ data: AgentAnswer; events: AgentEvent[]; gaps: GapReport[] }> {
  const events: AgentEvent[] = [];
  const gaps: GapReport[] = [];
  await runAgent({
    question,
    history: [],
    context: readerContext({}),
    today: TODAY,
    turn,
    fileGap: (g) => void gaps.push(g),
    emit: (e) => events.push(e),
    env: {
      web: async (q, _s, onRead) => {
        const out = web(q);
        if (out.status === 'found') for (const f of out.findings) onRead?.(f.url);
        return out;
      },
    },
  });
  const done = events.find((e) => e.type === 'done');
  assert.ok(done && done.type === 'done', JSON.stringify(events.filter((e) => e.type === 'error')));
  return { data: done.data, events, gaps };
}

const headings = (answer: string) => [...answer.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
const withoutScenarios = (answer: string) => answer.replace(/### Scenarios[\s\S]*?(?=\n### )/, '');
const passagesOf = (web: WebFinding[]) =>
  new Map(web.map((w, i) => [i + 1, `${w.title}\n${w.excerpt}`] as const));

test('neon demand outlook: planned, searched wide, shaped, scenarios by code, gaps filed', async () => {
  const calls: string[] = [];
  const { data, events, gaps } = await run(
    'What do you think will be the demand for neon in the future? Give sources.',
    (q) => (NEON[q]?.length ? { status: 'found', findings: NEON[q] } : { status: 'nothing' }),
    fakeTurn(JSON.stringify(NEON_PLAN), NEON_ANSWER, calls),
  );
  const a = data.answer;
  // The steps the reader sees.
  const status = events.filter((e) => e.type === 'status').map((e) => (e as { text: string }).text);
  assert.ok(status.includes('Planning…') && status.includes('Writing…'), status.join(' | '));
  assert.ok(data.trail.includes('Searching: Demand drivers by end use…'), data.trail.join(' | '));
  assert.ok(data.trail.includes('Reading pubs.usgs.gov…'), data.trail.join(' | '));
  // Budget: one plan call, one writing call.
  assert.deepEqual(calls, ['plan', 'write']);
  assert.equal(data.timing?.calls, 2);
  // Shape: bottom line first, then the sections in order.
  assert.ok(a.startsWith('Neon demand follows chipmaking'), a);
  assert.ok(!opensWithCorpusGap(a));
  assert.deepEqual(headings(a), [
    'What is established',
    'What drives it',
    'Scenarios',
    'What would change this',
    'Confidence and gaps',
    'Sources',
  ]);
  // Every figure in a [W#] sentence is in the passage it cites (outside the code-built scenario).
  assert.deepEqual(webFigureProblems(withoutScenarios(a), passagesOf(data.web)), []);
  // Scenario numbers are code's: the model wrote none of them.
  assert.doesNotMatch(NEON_ANSWER, /\b312\b|\b315\b/);
  assert.match(
    a,
    /\| Base \| the 2021–2025 trend[^|]*\| 312 million liters \| 230 × \(1 \+ 6\.3%\)\^5 = 312 \|/,
  );
  assert.match(
    a,
    /\| High \| Specialty gases growth, 6\.5% a year \[W4\] \| 315 million liters \|/,
  );
  assert.match(a, /```chat_ui\n\{"type":"chart","chart":"line"/);
  assert.doesNotMatch(a, /```scenario/);
  // An uncited forecast stated as fact is gone.
  assert.doesNotMatch(a, /will double/);
  // The sub-question no page answered: said by code, filed as a gap.
  assert.match(a, /No page read for this answer gave: price history\./);
  assert.ok(gaps.some((g) => g.box === 'research:prices' && g.topics.includes('neon')));
  assert.match(a, /### Sources\n\n\[W1\] \[W2\] \[W3\] \[W4\]/);
});

/** The other four: the plan call fails, so the code plan runs; the first three searches find a page. */
const OTHERS: [string, string, RegExp][] = [
  ['What is the demand outlook for helium over the next decade?', 'helium', /helium/],
  ['When could small modular reactors be commercial?', 'small modular reactors', /licensing/],
  [
    'What happens to chip supply if Ukraine neon is cut again?',
    'chip supply Ukraine neon',
    /shortage/,
  ],
  [
    'Compare gallium and germanium export controls impact',
    'gallium and germanium export controls',
    /price/,
  ],
];

for (const [question, subject, someQuery] of OTHERS)
  test(`research run: ${question}`, async () => {
    const calls: string[] = [];
    const asked: string[] = [];
    let n = 0;
    const answer = [
      `For ${subject}, the clearest figure in the pages read is that capacity reached 300 units in 2025 [W1].`,
      '',
      '### What is established',
      'Capacity reached 300 units in 2025, according to [W1].',
      'Prices are expected to rise.',
      '',
      '### What drives it',
      'Orders grew 12% in 2025, according to [W2].',
      '',
      '### Confidence and gaps',
      'Reasoning, not a sourced forecast: low; few pages gave figures.',
    ].join('\n');
    const { data, gaps } = await run(
      question,
      (q) => {
        asked.push(q);
        n++;
        if (n > 3) return { status: 'nothing' };
        const url = `https://www.example${n}.gov/${n}`;
        return {
          status: 'found',
          findings: [page(url, `Capacity reached 300 units in 2025. Orders grew 12% in 2025.`)],
        };
      },
      fakeTurn('Sure — I will research that.', answer, calls),
    );
    assert.deepEqual(calls, ['plan', 'write'], 'the code plan costs no extra call');
    assert.ok(asked.length >= 3 && asked.length <= 6, 'one search per sub-question');
    assert.ok(
      asked.every((q) => q.includes(subject.split(' ')[0])),
      asked.join(' | '),
    );
    assert.ok(
      asked.some((q) => someQuery.test(q)),
      asked.join(' | '),
    );
    const a = data.answer;
    assert.ok(a.startsWith(`For ${subject}`), a);
    assert.deepEqual(headings(a).slice(0, 2), ['What is established', 'What drives it']);
    assert.deepEqual(webFigureProblems(a, passagesOf(data.web)), []);
    assert.doesNotMatch(a, /expected to rise/, 'an uncited forecast goes');
    // Sub-questions 4.. found nothing: said once by code and filed.
    assert.match(a, /No page read for this answer gave: /);
    assert.equal(gaps.filter((g) => g.box?.startsWith('research:')).length, asked.length - 3);
  });
