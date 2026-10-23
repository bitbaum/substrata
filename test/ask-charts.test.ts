/**
 * Charts in answers (chatkit 0.15 + @bitbaum/chartkit).
 *
 * The model writes a `chart` block; chatkit validates it and hands it to the
 * app's renderer; here that renderer is chartkit. Rendered through the
 * thread, a bars block must become chartkit's figure, and without a renderer
 * chatkit's own table — a chart is never a blank. The prompt must ask for
 * charts on every conversational turn, and the tools whose rows are
 * chartable must carry the plain numbers and page links the instruction
 * tells the model to copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RICH_ANSWERS_INSTRUCTION, type ChartBlock } from '@bitbaum/chatkit';
import { ChatThread } from '@bitbaum/chatkit/react';
import { chartRenderers, renderChart } from '../components/portal/chat/chartRenderers';
import { systemPrompt } from '../lib/chat-agent/prompt';
import { readerContext } from '../lib/chat-context';
import { eventRow } from '../lib/chat-tools/shape';

const BARS: ChartBlock = {
  type: 'chart',
  chart: 'bars',
  caption: 'Gallium production, 2024',
  unit: 't',
  highlight: 'China',
  rows: [
    { label: 'China', value: 750, share: 98, href: '/atlas?view=world&country=cn' },
    { label: 'Japan', value: 10, estimated: true },
    { label: 'Russia', value: 5 },
  ],
};

const BLOCKS: ChartBlock[] = [
  BARS,
  {
    type: 'chart',
    chart: 'share',
    caption: 'Who holds ASML',
    other: 70,
    rows: [
      { label: 'BlackRock', share: 7, href: '/markets/asml#ownership' },
      { label: 'Capital', share: 5 },
    ],
  },
  {
    type: 'chart',
    chart: 'line',
    caption: 'Transformer lead time',
    unit: 'weeks',
    series: [
      {
        id: 'lt',
        label: 'Lead time',
        points: [
          { x: '2024', y: 80 },
          { x: '2025', y: 120 },
          { x: '2026', y: 150, href: '/data/series/x' },
        ],
      },
    ],
  },
  {
    type: 'chart',
    chart: 'timeline',
    caption: 'What changed',
    events: [
      { date: '2026-01-10', label: 'Export licence', tone: 'down', href: '/events#a' },
      { date: '2026-03-02', label: 'New line opens', tone: 'up' },
      { date: '2026-06-15', label: 'Price notice' },
    ],
  },
  {
    type: 'chart',
    chart: 'tiles',
    caption: 'Exposure',
    tiles: [
      { label: 'Holders', value: 12, href: '/exposure' },
      { label: 'Listed', value: '9 of 12' },
    ],
  },
];

function answerWith(block: ChartBlock): string {
  return `China makes nearly all of it.\n\n\`\`\`chat_ui\n${JSON.stringify(block)}\n\`\`\`\n\nThe rest is marginal.`;
}

function thread(content: string, renderers?: typeof chartRenderers): string {
  return renderToStaticMarkup(
    React.createElement(ChatThread, {
      messages: [{ id: 'a1', role: 'assistant', content }],
      renderers,
    }),
  );
}

test('every chart kind renders through chartkit', () => {
  for (const block of BLOCKS) {
    const html = renderToStaticMarkup(
      React.createElement(React.Fragment, null, renderChart(block)),
    );
    assert.match(html, /class="ck-chart ck-chart-/, `${block.chart}: no chartkit figure`);
    assert.ok(html.includes(block.caption), `${block.chart}: caption missing`);
  }
});

test('a bars block in an answer becomes a chartkit figure inside chatkit’s chart slot', () => {
  const html = thread(answerWith(BARS), chartRenderers);
  assert.match(
    html,
    /ck-rich[^"]*ck-chart|class="ck-chart"/,
    'chatkit did not open its chart slot',
  );
  assert.match(html, /<figure class="ck-chart ck-chart-bars"/, 'chartkit’s bars figure missing');
  assert.ok(html.includes('Gallium production, 2024'));
  // Shares travel as percent from the model and as fractions into chartkit.
  assert.ok(html.includes('98'), 'the share is shown');
  assert.ok(!html.includes('chat_ui'), 'the wire JSON never reaches the reader');
});

test('without a renderer chatkit draws the caption and a table, never a blank', () => {
  const html = thread(answerWith(BARS));
  assert.ok(!html.includes('ck-chart-bars'));
  assert.match(html, /<table/, 'the fallback table is missing');
  assert.ok(html.includes('Gallium production, 2024'));
  assert.ok(html.includes('China'));
});

test('the prompt asks for charts on every conversational turn', () => {
  const prompt = systemPrompt({
    context: readerContext({}),
    tools: [],
    replies: true,
  });
  assert.ok(prompt.includes(RICH_ANSWERS_INSTRUCTION));
  assert.match(prompt, /"chart":"bars"/);
});

test('chartable tool rows carry plain numbers and a page link', () => {
  const row = eventRow({
    id: '2026-01-10-licence',
    date: '2026-01-10',
    headline: 'Export licence required',
    kind: 'policy',
    effect: 'tightens',
    bottlenecks: ['Gallium'],
    participants: [],
    source: 'https://example.org',
    primary: true,
    quote: '',
    jurisdictions: ['CN'],
    acceptedOn: '2026-01-11',
  } as Parameters<typeof eventRow>[0]);
  assert.equal(row.page, '/events#2026-01-10-licence');
  assert.equal(row.tone, 'down');
});
