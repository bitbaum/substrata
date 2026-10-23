#!/usr/bin/env node
/**
 * The front page's layout facts, measured in a real browser at the widths a
 * phone has. Reading the source finds none of them (see heidi's AGENTS.md:
 * overflow reached production three times through review that passed).
 *
 *   node scripts/ux/home-layout.mjs --base http://localhost:3000
 *
 * Fails when, at 320, 390 and 1440px, light and dark:
 *   - the page scrolls sideways;
 *   - a button, link or field a finger must hit is under 44px in either
 *     direction (inline links inside a sentence are exempt, as in WCAG 2.5.8);
 *   - a fixed or sticky element other than the top bar and the tab bar exists
 *     (the floating Ask pill that sat on content was one);
 *   - the last line of the page, scrolled to the bottom, is not clear of the
 *     tab bar plus the room the feedback launcher needs (--widget-reserve);
 *   - the "worst right now" rows differ in anatomy: the meter must sit in the
 *     same x-position on every row;
 *   - a word is broken across two lines (more than 6px between its line tops).
 *
 * Needs a Playwright build: set PLAYWRIGHT_CORE to its path if it is not
 * resolvable from here (the fleet keeps one in loki's node_modules). Not part
 * of `pnpm run verify`: CI installs no browser. The parts that need none are
 * test/home.test.ts.
 */
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { BROKEN_WORDS_SOURCE } from '@bitbaum/chatkit/audit';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const { values } = parseArgs({
  options: { base: { type: 'string', default: 'http://localhost:3000' } },
});

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
  await page.goto(values.base + '/', { waitUntil: 'networkidle' });

  const facts = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      // Off-screen (the skip link waits at -100vw until focused) is not a target.
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.right > 0 &&
        r.bottom > 0 &&
        s.visibility !== 'hidden' &&
        s.display !== 'none'
      );
    };
    const label = (el) =>
      (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40);
    const targets = [...document.querySelectorAll('a, button, summary, textarea, input, select')]
      .filter(visible)
      // A link inside a sentence is as tall as the sentence.
      .filter(
        (el) =>
          !(
            el.tagName === 'A' &&
            el.closest('p, li > p') &&
            getComputedStyle(el).display === 'inline'
          ),
      )
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { label: label(el), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((t) => t.w < 44 || t.h < 44);
    const floating = [...document.querySelectorAll('body *')]
      .filter((el) => ['fixed', 'sticky'].includes(getComputedStyle(el).position) && visible(el))
      .filter((el) => !el.closest('.shell-topbar, .shell-tabbar, .shell-sidebar, [data-shell]'))
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60));
    const meters = [...document.querySelectorAll('.board-row-meter')].map((el) =>
      Math.round(el.getBoundingClientRect().right),
    );
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      targets,
      floating,
      meters,
    };
  });
  // A word must sit on one line: chatkit's audit lays every word out in a
  // Range and reports any drawn across two lines (the same check every product
  // runs; 0.14.2). A long name in a narrow cell, a missing overflow-wrap.
  facts.broken = await page.evaluate(`(${BROKEN_WORDS_SOURCE})(document.body)`);

  if (facts.overflow > 0) fail(width, `scrolls sideways by ${facts.overflow}px`);
  for (const t of facts.targets) fail(width, `target "${t.label}" is ${t.w}x${t.h}`);
  for (const f of facts.floating) fail(width, `floating element ${f}`);
  if (new Set(facts.meters).size > 1) fail(width, `worst rows' meters sit at ${facts.meters}`);
  for (const w of facts.broken) fail(width, `word broken across lines: "${w}"`);
  if (facts.meters.length === 0) fail(width, 'no worst rows rendered');

  if (phone) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const clear = await page.evaluate(() => {
      const bar = document.querySelector('.shell-tabbar').getBoundingClientRect();
      const links = [...document.querySelectorAll('.site-footer a')];
      const last = Math.max(...links.map((a) => a.getBoundingClientRect().bottom));
      const reserve =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--widget-reserve'),
        ) || 0;
      return { gap: bar.top - last, need: reserve ? 16 : 0 };
    });
    // The launcher is 48px; the last link must end above where it floats.
    if (clear.gap < 48)
      fail(
        width,
        `last footer link is ${Math.round(clear.gap)}px above the tab bar; the launcher needs 48`,
      );
  }
  await context.close();
}
await browser.close();

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('home layout: ok');
