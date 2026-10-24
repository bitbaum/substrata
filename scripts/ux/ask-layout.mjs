#!/usr/bin/env node
/**
 * The Ask panel's layout facts, measured in a real browser on a real page:
 * the things the owner saw on a phone on 2026-10-23 and that reading the
 * source cannot find — the answer could not be scrolled, there was no way
 * to expand, a "Quick replies" heading sat over nothing.
 *
 *   node scripts/ux/ask-layout.mjs --base http://localhost:3000 --out /tmp/ask
 *
 * Opens /bottlenecks/euv-lithography-scanners at 320, 390 and 1440px, light
 * and dark; opens the panel from the Ask pill; answers the question itself
 * (the /api/chat route is replaced with a scripted stream — a long answer
 * with a bars chart, three records read and suggested replies), and fails
 * when:
 *   - the thread inside the panel does not scroll (scrollHeight is not more
 *     than clientHeight, or scrollTop cannot change);
 *   - the page or the panel scrolls sideways;
 *   - a button, link or field in the panel is under 44px either way (links
 *     inside a sentence are exempt, as in WCAG 2.5.8);
 *   - the chart did not draw as chartkit's figure, or the thought row
 *     ("Thought for …") is missing, or a replies row is drawn empty;
 *   - a word is broken across two lines (chatkit's audit);
 *   - Expand does not land on /chat with the same messages;
 *   - anything but the sheet's own UI sits over the reply row (the Loki
 *     feedback launcher did, 2026-10-23), or the launcher is not back once
 *     the sheet closes, or it is more than the slim edge tab on /chat. The widget only loads with a
 *     token, so a stand-in launcher obeys the widget's documented host
 *     contract (loki widget/host-scan.ts readPlaceDirective: <html>, then
 *     every rendered [data-fc-place], the last one wins);
 *   - /chat's composer is not the panel's: a kicker over the box, a
 *     paperclip, or a different set of controls;
 *   - the answer's table (the Kazakh uranium rows, fixtures/) does not draw,
 *     does not show eight rows and then all on "Show all", scrolls sideways
 *     once opened, is not cards on a phone, cuts a word, or has a control
 *     under 44px. Its screenshot is table-<width>-<scheme>.png.
 * Screenshots of the panel open go to --out (default: the scratchpad).
 *
 * Needs a Playwright build: set PLAYWRIGHT_CORE to its path if it is not
 * resolvable from here, and CHROMIUM_PATH to a Chromium. Not part of
 * `pnpm run verify`: CI installs no browser. The parts that need none are
 * test/ask-charts.test.ts, test/ask-thread.test.ts and test/chat-ux.test.ts.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { BROKEN_WORDS_SOURCE } from '@bitbaum/chatkit/audit';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3000' },
    out: { type: 'string', default: '/tmp/ask-layout' },
  },
});
mkdirSync(values.out, { recursive: true });

const PAGE = '/bottlenecks/euv-lithography-scanners';
/**
 * The table an answer carries (components/portal/chat/AnswerTables.tsx): the
 * Kazakh uranium rows exactly as the code builds them today —
 * test/answer-table.test.ts fails when this fixture drifts from the builder.
 */
const TABLE = JSON.parse(
  readFileSync(new URL('./fixtures/kz-uranium-table.json', import.meta.url), 'utf8'),
);
const QUESTION = 'Who makes EUV scanners, and who supplies the light source?';

const CHART = {
  type: 'chart',
  chart: 'bars',
  caption: 'EUV scanner shipments by maker, 2025 (units)',
  unit: 'units',
  highlight: 'ASML',
  rows: [
    { label: 'ASML', value: 44, share: 100, href: '/markets/asml' },
    { label: 'Nikon', value: 0, note: 'No EUV tool shipped' },
    { label: 'Canon', value: 0, note: 'Nanoimprint only' },
  ],
};
const ANSWER = [
  'Only [ASML](/markets/asml) ships EUV lithography scanners; nobody else has shipped one. The light source is made by Cymer, which ASML owns, and the optics by [Zeiss](/markets/zeiss).',
  '```chat_ui',
  JSON.stringify(CHART),
  '```',
  '## What the records say',
  ...Array.from(
    { length: 10 },
    (_, i) =>
      `${i + 1}. **Record ${i + 1}.** Sourced: the scanner count for the year is read from ASML’s annual report, with the Twinscan NXE and EXE lines counted together, and the EXE:5200 high-NA tool counted as one unit wherever it shipped.`,
  ),
  '## What is judgement',
  'The horizon of a second supplier is an analyst judgement, not a sourced figure: no other maker has a light source at the needed power, and the optics have one supplier.',
].join('\n');

/** The scripted /api/chat stream, in the shape the route writes (NDJSON). */
function scriptedStream() {
  const events = [
    { type: 'status', text: 'Reading the question…' },
    { type: 'tool', label: 'Looking up EUV lithography scanners' },
    { type: 'tool', label: 'Reading listings and exposure for ASML' },
    ...ANSWER.split(' ').map((w) => ({ type: 'delta', text: `${w} ` })),
    {
      type: 'done',
      data: {
        answer: ANSWER,
        sources: [
          {
            number: 1,
            id: 'euv',
            title: 'EUV lithography scanners',
            href: PAGE,
            evidence: 'Sourced',
            primary: [],
            kind: 'bottleneck',
          },
          {
            number: 2,
            id: 'asml',
            title: 'ASML',
            href: '/markets/asml',
            evidence: 'Sourced',
            primary: [],
            kind: 'company',
          },
          {
            number: 3,
            id: 'zeiss',
            title: 'Zeiss',
            href: '/markets/zeiss',
            evidence: 'Candidate source',
            primary: [],
            kind: 'company',
          },
        ],
        tables: [TABLE],
        trail: ['Looking up EUV lithography scanners', 'Reading listings and exposure for ASML'],
        followUps: ['What does Zeiss make for the scanner?'],
        replies: ['Who buys the scanners?', 'How many ship a year?'],
      },
    },
  ];
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

/**
 * A stand-in for the Loki launcher: round, 56px, on the right edge where the
 * real one sat over the reply row, and hidden exactly when the widget's host
 * directive says "hidden".
 */
const LAUNCHER_STAND_IN = `(() => {
  const directive = () => {
    let v = document.documentElement.getAttribute('data-fc-place');
    for (const el of document.querySelectorAll('body [data-fc-place]'))
      if (el.getClientRects().length > 0) v = el.getAttribute('data-fc-place');
    return v;
  };
  const mount = () => {
    const fab = document.createElement('div');
    fab.id = 'loki-stand-in';
    fab.style.cssText = 'position:fixed;right:12px;width:56px;height:56px;border-radius:50%;z-index:2147483000;background:#888';
    document.body.appendChild(fab);
    const place = () => {
      const row = document.querySelector('.ask-sheet .ck-replies, .companion .ck-replies');
      const r = row && row.getBoundingClientRect();
      const d = directive();
      // "tab": the slim edge handle, flush with the edge, off the reply row.
      const tab = d === 'tab';
      fab.style.width = tab ? '28px' : '56px';
      fab.style.height = tab ? '72px' : '56px';
      fab.style.right = tab ? '0' : '12px';
      fab.style.borderRadius = tab ? '12px 0 0 12px' : '50%';
      fab.style.top = tab ? innerHeight * 0.4 + 'px' : (r && r.height ? r.top : innerHeight * 0.6) + 'px';
      fab.style.display = d === 'hidden' ? 'none' : '';
    };
    new MutationObserver(place).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    setInterval(place, 200);
    place();
  };
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);
})();`;

/** The composer's anatomy: its controls by name, and any text over the box. */
const COMPOSER_FACTS = `(() => {
  const box = document.querySelector('.ck-composer');
  if (!box) return null;
  const controls = [...box.querySelectorAll('button, input, select, a')]
    .filter((el) => el.getClientRects().length > 0)
    .map((el) => el.getAttribute('aria-label') || el.textContent.trim())
    .sort();
  const textarea = box.querySelector('textarea');
  const above = [...box.querySelectorAll('*')]
    .filter((el) => el.children.length === 0 && el.getClientRects().length > 0 && el.textContent.trim())
    .filter((el) => textarea && el.getBoundingClientRect().bottom <= textarea.getBoundingClientRect().top + 1)
    .map((el) => el.textContent.trim());
  return { controls, above };
})()`;

/** Points along the reply row whose topmost element is not inside `selector`. */
const COVERED = (selector) => `(() => {
  const row = document.querySelector('${selector} .ck-replies');
  if (!row) return ['no reply row'];
  // Where a reader meets the row: the thread at rest at its end, under the
  // answer. Centred, a long answer (a table) parked the row at 40% of the
  // screen, where any edge tab sits whatever the page does.
  const thread = row.closest('.ck-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
  else row.scrollIntoView({ block: 'end' });
  const r = row.getBoundingClientRect();
  const out = [];
  for (let x = r.left + 4; x < r.right; x += 16)
    for (const y of [r.top + 4, r.top + r.height / 2, r.bottom - 4]) {
      const top = document.elementFromPoint(Math.min(x, innerWidth - 1), y);
      if (top && !top.closest('${selector}'))
        out.push((top.id || top.className || top.tagName) + ' at ' + Math.round(x) + ',' + Math.round(y));
    }
  return [...new Set(out)].slice(0, 3);
})()`;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const failures = [];
let scheme_ = '';
const fail = (width, what) => failures.push(`${width}px ${scheme_}: ${what}`);

for (const [width, scheme] of [320, 390, 1440].flatMap((w) => [
  [w, 'light'],
  [w, 'dark'],
])) {
  const phone = width < 768;
  const context = await browser.newContext({
    viewport: { width, height: phone ? 780 : 900 },
    colorScheme: scheme,
  });
  scheme_ = scheme;
  const page = await context.newPage();
  await page.addInitScript((mode) => {
    try {
      localStorage.setItem('substrata-theme', mode);
    } catch {
      // Blocked storage: the page follows prefers-color-scheme, set above.
    }
  }, scheme);
  await page.addInitScript(LAUNCHER_STAND_IN);
  await page.route('**/api/chat', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/x-ndjson' },
      body: scriptedStream(),
    });
  });
  await page.goto(values.base + PAGE, { waitUntil: 'networkidle' });

  await page.click('.ask-dock-toggle');
  const sheet = page.locator('.ask-sheet');
  await sheet.waitFor({ state: 'visible' });
  await sheet.locator('textarea').fill(QUESTION);
  await sheet.locator('textarea').press('Enter');
  await sheet.locator('figure.ck-chart-bars').waitFor({ timeout: 15_000 });
  await sheet.locator('.ck-replies').waitFor({ timeout: 5_000 });

  const facts = await page.evaluate(() => {
    const sheet = document.querySelector('.ask-sheet');
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const label = (el) =>
      (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40);
    const targets = [...sheet.querySelectorAll('a, button, summary, textarea, input, select')]
      .filter(visible)
      // A link inside a sentence is as tall as the sentence; a chart's row
      // labels are a figure's text, not standalone targets.
      .filter(
        (el) =>
          !(
            el.tagName === 'A' &&
            (el.closest('p, li, figure, .ck-chart') || getComputedStyle(el).display === 'inline')
          ),
      )
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { label: label(el), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((t) => t.w < 44 || t.h < 44);
    const thread = sheet.querySelector('.ck-thread');
    const before = thread.scrollTop;
    thread.scrollTop = 0;
    const atTop = thread.scrollTop;
    thread.scrollTop = 10_000;
    const atBottom = thread.scrollTop;
    const replies = [...sheet.querySelectorAll('.ck-replies')].map(
      (r) => r.querySelectorAll('button').length,
    );
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      sheetOverflow: sheet.scrollWidth - sheet.clientWidth,
      threadOverflow: thread.scrollWidth - thread.clientWidth,
      scroll: {
        height: thread.scrollHeight,
        client: thread.clientHeight,
        before,
        atTop,
        atBottom,
      },
      targets,
      chart: Boolean(sheet.querySelector('figure.ck-chart.ck-chart-bars')),
      thought: sheet.querySelector('.ck-thinking')?.textContent?.trim() ?? '',
      replies,
      quickRepliesHeading: /Quick replies/i.test(sheet.textContent ?? ''),
      modelLabel: /Model:/.test(sheet.querySelector('.ck-composer')?.textContent ?? ''),
      paperclip: Boolean(sheet.querySelector('.ck-composer [aria-label*="ttach"]')),
      messages: [...sheet.querySelectorAll('.ck-turn')].map((t) =>
        (t.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
      ),
    };
  });
  facts.broken = await page.evaluate(
    `(${BROKEN_WORDS_SOURCE})(document.querySelector('.ask-sheet'))`,
  );

  if (facts.overflow > 0) fail(width, `page scrolls sideways by ${facts.overflow}px`);
  if (facts.sheetOverflow > 0) fail(width, `panel scrolls sideways by ${facts.sheetOverflow}px`);
  if (facts.threadOverflow > 0) fail(width, `thread scrolls sideways by ${facts.threadOverflow}px`);
  if (facts.scroll.height <= facts.scroll.client)
    fail(width, `thread does not scroll: ${facts.scroll.height} in ${facts.scroll.client}`);
  if (facts.scroll.atBottom <= facts.scroll.atTop) fail(width, 'thread scrollTop cannot change');
  for (const t of facts.targets) fail(width, `target "${t.label}" is ${t.w}x${t.h}`);
  if (!facts.chart) fail(width, 'the bars chart did not draw as chartkit’s figure');
  if (!/Thought for/.test(facts.thought)) fail(width, `no thought row: "${facts.thought}"`);
  if (!/Read 3 records/.test(facts.thought)) fail(width, `records not in the thought row`);
  if (facts.replies.some((n) => n === 0)) fail(width, 'a replies row drawn with nothing in it');
  if (facts.quickRepliesHeading) fail(width, 'a "Quick replies" heading');
  if (facts.modelLabel) fail(width, 'a model label in the composer');
  if (facts.paperclip) fail(width, 'a paperclip in the panel composer');
  for (const w of facts.broken) fail(width, `word broken across lines: "${w}"`);
  if (facts.messages.length < 2) fail(width, `only ${facts.messages.length} turns drawn`);

  // The table under the answer: eight rows, then all of them, never sideways.
  const table = sheet.locator('figure.answer-table');
  if (!(await table.count())) fail(width, 'the answer table did not draw');
  else {
    const before = await table.locator('tbody tr').count();
    if (before !== 8) fail(width, `the table shows ${before} rows before "Show all", not 8`);
    await table.locator('.answer-table-more').click();
    const after = await table.locator('tbody tr').count();
    if (after !== TABLE.rows.length)
      fail(width, `"Show all" shows ${after} rows, not ${TABLE.rows.length}`);
    await table.locator('.answer-table-shared summary').first().click();
    const wide = await page.evaluate(() => {
      const fig = document.querySelector('.ask-sheet figure.answer-table');
      const thread = document.querySelector('.ask-sheet .ck-thread');
      return {
        fig: fig.scrollWidth - fig.clientWidth,
        thread: thread.scrollWidth - thread.clientWidth,
        page: document.documentElement.scrollWidth - window.innerWidth,
        cards: getComputedStyle(fig.querySelector('tr')).display === 'block',
      };
    });
    if (wide.fig > 0 || wide.thread > 0 || wide.page > 0)
      fail(width, `the open table scrolls sideways: ${JSON.stringify(wide)}`);
    if (width < 768 && !wide.cards) fail(width, 'on a phone the table rows are not cards');
    for (const w of await page.evaluate(
      `(${BROKEN_WORDS_SOURCE})(document.querySelector('.ask-sheet figure.answer-table'))`,
    ))
      fail(width, `word broken across lines in the table: "${w}"`);
    const small = await page.evaluate(
      () =>
        [
          ...document.querySelectorAll(
            '.ask-sheet figure.answer-table button, .ask-sheet figure.answer-table summary',
          ),
        ]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.height < 44 || r.width < 44)).length,
    );
    if (small) fail(width, `${small} table control(s) under 44px`);
    await table.screenshot({ path: join(values.out, `table-${width}-${scheme}.png`) });
  }

  for (const c of await page.evaluate(COVERED('.ask-sheet')))
    fail(width, `something sits over the panel's reply row: ${c}`);
  const panelComposer = await page.evaluate(COMPOSER_FACTS);
  if (panelComposer?.above.length)
    fail(width, `text over the panel's composer: ${panelComposer.above}`);

  await page.screenshot({ path: join(values.out, `ask-${width}-${scheme}.png`) });

  // Close: the launcher comes back; open again: it steps aside again.
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.waitForTimeout(400);
  if (!(await page.locator('#loki-stand-in').isVisible()))
    fail(width, 'the feedback launcher did not come back when the panel closed');
  await page.click('.ask-dock-toggle');
  await sheet.waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  if (await page.locator('#loki-stand-in').isVisible())
    fail(width, 'the feedback launcher shows over the reopened panel');

  // Expand: /chat with the same messages, from the same thread.
  await sheet.getByRole('button', { name: 'Expand', exact: true }).click();
  await page.waitForURL(/\/chat\?thread=/, { timeout: 15_000 });
  await page.locator('.ck-turn').first().waitFor({ timeout: 15_000 });
  const expanded = await page.evaluate(() =>
    [...document.querySelectorAll('.ck-turn')].map((t) =>
      (t.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    ),
  );
  if (expanded.length !== facts.messages.length)
    fail(width, `Expand: ${expanded.length} turns on /chat, ${facts.messages.length} in the panel`);
  else
    facts.messages.forEach((m, i) => {
      if (expanded[i] !== m) fail(width, `Expand: turn ${i + 1} differs on /chat`);
    });
  if (await page.locator('.ask-sheet').count()) fail(width, 'the panel is still mounted on /chat');
  await page.locator('.ck-replies').first().waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  // On /chat the launcher is the slim edge tab: present, but never the round
  // button that sat on the reply row.
  const standIn = page.locator('#loki-stand-in');
  if (!(await standIn.isVisible())) fail(width, 'the launcher is not on /chat (the edge tab is)');
  else if ((await standIn.boundingBox()).width > 28)
    fail(width, 'the feedback launcher shows on /chat as more than the edge tab');
  for (const c of await page.evaluate(COVERED('.companion')))
    fail(width, `something sits over /chat's reply row: ${c}`);
  const chatComposer = await page.evaluate(COMPOSER_FACTS);
  if (!chatComposer) fail(width, 'no composer on /chat');
  else {
    if (chatComposer.above.length)
      fail(width, `a kicker over /chat's composer: ${chatComposer.above}`);
    if (JSON.stringify(chatComposer.controls) !== JSON.stringify(panelComposer?.controls))
      fail(
        width,
        `/chat's composer is not the panel's: [${chatComposer.controls}] vs [${panelComposer?.controls}]`,
      );
  }
  await page.screenshot({ path: join(values.out, `chat-${width}-${scheme}.png`) });
  await context.close();
}
await browser.close();

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`ask layout: ok (screenshots in ${values.out})`);
