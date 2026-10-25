/**
 * Research mode (docs/architecture/2026-10-25-research-mode.md): analytical and
 * forward-looking questions are planned into sub-questions, searched wider,
 * answered in a fixed shape, with scenario numbers computed by code from cited
 * inputs. No network and no model: every search, page and model turn is a fake.
 * The tests assert the shape and the guards, never the model's prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRichBlock } from '@bitbaum/chatkit';

import { isAnalysis, routeQuestion } from '../lib/chat-agent/route';
import {
  fallbackPlan,
  parsePlan,
  planResearch,
  PLAN_LIMITS,
} from '../lib/chat-agent/research-plan';
import { READ_LIMITS, selectPassages } from '../lib/chat-agent/research-read';
import {
  scenarioStreamFilter,
  shapeAnswer,
  SECTIONS,
  uncitedForecasts,
} from '../lib/chat-agent/research-shape';
import { renderScenario, scenario, scenarioSpecIn } from '../lib/chat-agent/scenario-calc';
import type { ModelTurn } from '../lib/chat-agent/turn';
import type { WebFinding } from '../lib/chat-web';

const TODAY = '2026-10-25';
const FIVE = [
  'What do you think will be the demand for neon in the future? Give sources.',
  'What is the demand outlook for helium over the next decade?',
  'When could small modular reactors be commercial?',
  'What happens to chip supply if Ukraine neon is cut again?',
  'Compare gallium and germanium export controls impact',
];

// --- routing ----------------------------------------------------------------------

test('analytical and forward-looking questions are routed to research mode', () => {
  for (const q of [...FIVE, 'What would a blockade of Taiwan do to AI chips?'])
    assert.ok(isAnalysis(q) && routeQuestion(q, TODAY).analysis && routeQuestion(q, TODAY).web, q);
  for (const q of [
    'What did Kazatomprom say about 2026 production guidance?',
    "What is Kazatomprom's share price today?",
    'Which countries produce helium?',
    'How much refined gallium does China make?',
    "What is Substrata's methodology for evidence states?",
  ])
    assert.equal(routeQuestion(q, TODAY).analysis, false, q);
});

// --- the plan ----------------------------------------------------------------------

test('a plan is code-validated JSON: 3–6 sub-questions, listed tools, their own arguments', () => {
  const plan = parsePlan(
    JSON.stringify({
      subject: 'neon',
      subQuestions: [
        { id: 'supply', ask: 'Current global supply and who', query: 'global neon supply' },
        { id: 'drivers', ask: 'Demand drivers by end use', query: 'neon demand semiconductors' },
        { id: 'drivers', ask: 'A duplicate id is dropped', query: 'something else' },
        { id: 'risks', ask: 'Supply risks and responses', query: 'neon shortage Ukraine' },
        ...[1, 2, 3, 4].map((i) => ({
          id: `x${i}`,
          ask: `Extra question ${i}`,
          query: `query ${i}`,
        })),
      ],
      tools: [
        { name: 'find_numbers', args: { query: 'neon', evil: 'ignored' } },
        { name: 'web_search', args: { query: 'not on the list' } },
        { name: 'producers_in', args: { resource: 'neon' } }, // missing required country
        { name: 'restrictions_on', args: { resource: 'neon' } },
      ],
    }),
  );
  assert.ok(plan);
  assert.equal(plan.subQuestions.length, PLAN_LIMITS.maxSubQuestions);
  assert.deepEqual(
    plan.calls.map((c) => [c.name, JSON.parse(c.args)]),
    [
      ['find_numbers', { query: 'neon' }],
      ['restrictions_on', { resource: 'neon' }],
    ],
  );
  assert.equal(parsePlan('{"subject":"neon","subQuestions":[]}'), null, 'too few');
  assert.equal(parsePlan('I would search for neon.'), null, 'not JSON');
});

test('no plan in time, or no JSON: the plan built in code, never a wait', async () => {
  const slow: ModelTurn = () => new Promise(() => {});
  const t0 = Date.now();
  const plan = await planResearch(FIVE[0], slow, TODAY, 30);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(plan.by, 'code');
  const prose: ModelTurn = async () => ({
    text: 'Here is my plan: search.',
    calls: [],
    model: 'm',
  });
  assert.equal((await planResearch(FIVE[0], prose, TODAY)).by, 'code');
  for (const q of FIVE) {
    const p = fallbackPlan(q, TODAY);
    assert.ok(p.subQuestions.length >= 3 && p.subQuestions.length <= 6, q);
    assert.ok(
      p.subQuestions.every((s) => s.query.toLowerCase().includes(p.subject.split(' ')[0])),
      q,
    );
  }
  assert.equal(fallbackPlan(FIVE[0], TODAY).subject, 'neon');
});

// --- the read ------------------------------------------------------------------------

const f = (url: string, excerpt: string, extra: Partial<WebFinding> = {}): WebFinding => ({
  title: url,
  url,
  excerpt,
  ...extra,
});

test('passages: one URL once, two per site, strong sources before farms, each sub-question served', () => {
  const sub = (id: string) => ({ id, ask: id, query: id });
  const kept = selectPassages([
    {
      sub: sub('supply'),
      findings: [
        f('https://www.marketsandmarkets.com/neon', 'Neon market to reach 9 billion'),
        f('https://pubs.usgs.gov/mcs', 'US consumption 230 million liters', {
          published: '2026-01',
        }),
        f('https://www.reuters.com/a', 'Ukraine 50%'),
        f('https://www.reuters.com/b', 'b'),
        f('https://www.reuters.com/c', 'c'),
      ],
    },
    {
      sub: sub('prices'),
      findings: [f('https://pubs.usgs.gov/mcs', 'dup'), f('https://www.reuters.com/d', 'd')],
    },
  ]);
  assert.equal(kept[0].finding.url, 'https://pubs.usgs.gov/mcs', 'official first');
  assert.equal(kept[1].sub.id, 'prices', 'round robin: each sub-question gets its best page');
  assert.equal(new Set(kept.map((k) => k.finding.url)).size, kept.length, 'one URL once');
  assert.ok(kept.filter((k) => k.finding.url.includes('reuters')).length <= READ_LIMITS.perDomain);
  assert.ok(kept.findIndex((k) => k.finding.url.includes('marketsandmarkets')) > 1, 'farm last');
});

// --- scenarios: code writes the numbers ---------------------------------------------------

const PASSAGES = new Map<number, string>([
  [
    1,
    'U.S. apparent consumption of neon was estimated at 180 million liters in 2021 and 230 million liters in 2025.',
  ],
  [3, 'Before 2022, Ukraine supplied about 50% of semiconductor-grade neon.'],
  [4, 'TechInsights expects electronic specialty gases to grow 6.5% a year through 2030.'],
]);
const SPEC = {
  measure: 'US apparent consumption of neon',
  unit: 'million liters',
  inputs: [
    { id: 'a', label: 'US apparent consumption, 2021', value: 180, year: 2021, cite: 'W1' },
    { id: 'b', label: 'US apparent consumption, 2025', value: 230, year: 2025, cite: 'W1' },
    { id: 'g', label: 'Specialty gases growth', value: 6.5, unit: '%', cite: 'W4' },
    { id: 'u', label: 'Ukraine share before 2022', value: 50, unit: '%', cite: 'W3' },
    { id: 'z', label: 'Invented growth', value: 12, unit: '%', cite: 'W4' },
  ],
  start: 'b',
  horizon: 2030,
  cases: [
    { name: 'Low', rate: 'flat' },
    { name: 'Base', rate: 'cagr:a:b' },
    { name: 'High', rate: 'g' },
    { name: 'Made up', rate: 'z' },
  ],
  assumptions: ['US demand follows its own recent trend'],
};

test('scenario: inputs checked against their passages, cases computed with the formula shown', () => {
  const s = scenario(SPEC, PASSAGES);
  assert.ok(s);
  assert.deepEqual(
    s.cases.map((c) => c.name),
    ['Low', 'Base', 'High'],
    'a case resting on an input no passage prints is dropped',
  );
  assert.match(s.rejected.join(' '), /Invented growth/);
  const base = 230 * (230 / 180) ** (5 / 4);
  assert.ok(Math.abs(s.cases[1].value - base) < 1e-9);
  assert.equal(s.cases[0].value, 230);
  assert.ok(Math.abs(s.cases[2].value - 230 * 1.065 ** 5) < 1e-9);
  assert.equal(s.cases[1].formula, '230 × (1 + 6.3%)^5 = 312');
  const shocked = scenario(
    {
      ...SPEC,
      cases: [
        { name: 'Flat', rate: 'flat' },
        { name: 'Cut', rate: 'flat', shock: 'u' },
      ],
    },
    PASSAGES,
  );
  assert.equal(shocked?.cases[1].value, 115);
  assert.match(shocked!.cases[1].formula, /230 × \(1 − 50\.0%\)/);
  // No cited level to start from: no scenario.
  assert.equal(scenario({ ...SPEC, start: 'g' }, PASSAGES), null);
  assert.equal(scenario({ ...SPEC, cases: [SPEC.cases[0]] }, PASSAGES), null);
});

test('the scenario block: labelled reasoning, inputs cited, a chart chatkit accepts', () => {
  const block = renderScenario(scenario(SPEC, PASSAGES)!);
  assert.match(block, /reasoning, not a sourced forecast/);
  assert.match(block, /\| Base \| the 2021–2025 trend/);
  assert.match(block, /Inputs: .*230 million liters \[W1\]/);
  assert.match(block, /Left out, because the cited page does not print it: Invented growth/);
  const json = block.match(/```chat_ui\n([\s\S]*?)\n```/)![1];
  const chart = parseRichBlock(json);
  assert.ok(chart && chart.type === 'chart' && chart.chart === 'line', 'chatkit draws it');
});

test('a ```scenario block is found, and never streamed to the reader', () => {
  const answer = `Framing.\n\`\`\`scenario\n${JSON.stringify(SPEC)}\n\`\`\`\nAfter.`;
  assert.equal(scenarioSpecIn(answer)?.spec.start, 'b');
  const filter = scenarioStreamFilter();
  let shown = '';
  for (const chunk of answer.match(/.{1,5}/gs)!) shown += filter.feed(chunk);
  shown += filter.flush();
  assert.equal(shown, 'Framing.\n\nAfter.');
});

// --- shape and guards ------------------------------------------------------------------

test('an uncited forecast stated as fact is caught; a cited or labelled one is not', () => {
  assert.deepEqual(uncitedForecasts('Demand will double by 2030.'), [
    'Demand will double by 2030.',
  ]);
  assert.deepEqual(uncitedForecasts('Prices are expected to rise.'), [
    'Prices are expected to rise.',
  ]);
  assert.deepEqual(uncitedForecasts('TechInsights expects 6.5% a year through 2030 [W4].'), []);
  assert.deepEqual(
    uncitedForecasts('Reasoning, not a sourced forecast: demand will rise with wafer starts.'),
    [],
  );
});

test('the shape: bottom line first, sections in order, gaps said by code, Sources from citations', () => {
  const out = shapeAnswer(
    [
      '### What drives it',
      'Chips [W2].',
      '### Bottom line',
      'never mind',
      '### Sources',
      '- a list the model wrote',
      '### What is established',
      'Consumption rose [W1].',
    ].join('\n'),
    {
      unanswered: [{ id: 'prices', ask: 'Price history', query: 'neon price' }],
      webCount: 2,
    },
  );
  const heads = [...out.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  assert.ok(out.startsWith('never mind'), 'the bottom line opens it, wherever it was written');
  assert.deepEqual(
    heads.filter((h) => (SECTIONS as readonly string[]).includes(h)),
    ['What is established', 'What drives it', 'Confidence and gaps', 'Sources'],
  );
  assert.match(out, /No page read for this answer gave: price history\./);
  assert.match(out, /### Sources\n\n\[W1\] \[W2\]$/);
  assert.doesNotMatch(out, /a list the model wrote/);
});
