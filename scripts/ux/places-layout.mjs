#!/usr/bin/env node
/**
 * The place profiles' layout facts — a material (/resources/[slug]) and a
 * country (/world/[iso2]) — measured in a real browser at the widths a phone
 * has. Reading the source finds none of them (see heidi's AGENTS.md:
 * overflow reached production three times through review that passed).
 *
 *   node scripts/ux/places-layout.mjs --base http://localhost:3000
 *
 * Fails when, at 320, 390 and 1440px, light and dark, on each page:
 *   - the page scrolls sideways;
 *   - a button, link, summary or field a finger must hit is under 44px in
 *     either direction (an inline link or figure — one that sits in running
 *     text — is exempt, as in WCAG 2.5.8);
 *   - a word is cut across two lines (@bitbaum/chatkit/audit): a long
 *     country name in a narrow cell, a date that lost its nowrap;
 *   - chart text leaves its chart or overlaps other text in it
 *     (@bitbaum/chartkit/audit);
 *   - the ranked bars do not share one baseline: every bar track must start
 *     at the same x, or the chart is a list of unrelated bars.
 *
 * Needs a Playwright build: set PLAYWRIGHT_CORE to its path if it is not
 * resolvable from here, and CHROMIUM_PATH to a Chromium. Not part of
 * `pnpm run verify`: CI installs no browser. The parts that need none are
 * test/places.test.ts.
 */
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { BROKEN_WORDS_SOURCE } from '@bitbaum/chatkit/audit';
import { CHART_DEFECTS_SOURCE } from '@bitbaum/chartkit/audit';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3000' },
    pages: {
      type: 'string',
      default: '/resources/gallium,/resources/rare-earths,/world/cn,/world/ne',
    },
  },
});

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const failures = [];

for (const path of values.pages.split(',')) {
  for (const [width, scheme] of [320, 390, 1440].flatMap((w) => [
    [w, 'light'],
    [w, 'dark'],
  ])) {
    const fail = (what) => failures.push(`${path} ${width}px ${scheme}: ${what}`);
    const phone = width < 768;
    const context = await browser.newContext({
      viewport: { width, height: phone ? 780 : 900 },
      colorScheme: scheme,
    });
    const page = await context.newPage();
    const response = await page.goto(values.base + path, { waitUntil: 'networkidle' });
    if (!response || response.status() >= 400) {
      fail(`responded ${response ? response.status() : 'nothing'}`);
      await context.close();
      continue;
    }
    // Folded rows are measured open too: a wall that only overflows once
    // unfolded is still a wall.
    await page.evaluate(() => {
      for (const d of document.querySelectorAll('details')) d.open = true;
    });

    const facts = await page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
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
      // A link or figure button that is part of a sentence or a table cell is
      // text (WCAG 2.5.8's inline exception): it is laid out inline and the
      // text around it is longer than itself. Anything a page lays out as a
      // control — a tile, a row, a chip — is a block or flex, and is measured.
      const inline = (el) => {
        if (!getComputedStyle(el).display.startsWith('inline')) return false;
        const host = el.closest('p, td, th, li, figcaption, blockquote, dd');
        if (!host) return false;
        if (host.matches('td, th')) return true;
        return host.textContent.trim().length > el.textContent.trim().length;
      };
      const targets = [...document.querySelectorAll('a, button, summary, textarea, input, select')]
        .filter(visible)
        .filter((el) => !(['A', 'BUTTON'].includes(el.tagName) && inline(el)))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { label: label(el), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((t) => t.w < 44 || t.h < 44);
      const tracks = [...document.querySelectorAll('.ck-bars')].map((chart) =>
        [...chart.querySelectorAll('.ck-bar-track')].map((el) =>
          Math.round(el.getBoundingClientRect().left),
        ),
      );
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        targets,
        tracks,
        tiles: document.querySelectorAll('.ck-tile').length,
      };
    });

    // A word sits on one line and chart text stays inside its chart: the
    // fleet's own audits, so this gate and the packages' agree on a defect.
    facts.broken = await page.evaluate(`(${BROKEN_WORDS_SOURCE})(document.body)`);
    facts.chart = await page.evaluate(`(${CHART_DEFECTS_SOURCE})(document.body)`);

    if (facts.overflow > 0) fail(`scrolls sideways by ${facts.overflow}px`);
    for (const t of facts.targets) fail(`target "${t.label}" is ${t.w}x${t.h}`);
    for (const w of facts.broken) fail(`word broken across lines: "${w}"`);
    for (const d of facts.chart) fail(`chart: ${d}`);
    for (const xs of facts.tracks)
      if (new Set(xs).size > 1) fail(`bars start at different x: ${[...new Set(xs)]}`);
    if (facts.tiles === 0) fail('no at-a-glance tiles rendered');
    await context.close();
  }
}
await browser.close();

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('places layout: ok');
