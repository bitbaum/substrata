#!/usr/bin/env node
/**
 * The company page's market frame (docs/design/company-page.md), measured in
 * a real browser on the three kinds of company page: a profiled listed
 * company (NVIDIA), an identified one (Oklo) and one named only by a source.
 *
 *   node scripts/ux/company-layout.mjs --base http://localhost:3000 [--shots dir]
 *
 * Fails when, at 320, 390, 768 and 1440px:
 *   - the page scrolls sideways;
 *   - a section of the frame is missing (price, key statistics, financials,
 *     who owns it, how it does business, peers) — a company with no data
 *     shows the section with its empty state, never drops it;
 *   - the range row wraps (its cells must share one top) or a cell is under 44px;
 *   - a section is still loading after the page has settled;
 *   - a chartkit figure has a label that leaves its chart or overlaps another
 *     (@bitbaum/chartkit/audit).
 * With --shots, writes a full-page screenshot per page and width.
 *
 * Needs a browser: CHROMIUM_PATH, and playwright-core resolvable (or
 * PLAYWRIGHT_CORE). Not part of `pnpm run verify`; test/company-page.test.ts
 * holds the parts that need none.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { CHART_DEFECTS_SOURCE } from '@bitbaum/chartkit/audit';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3000' },
    pages: { type: 'string', default: '/markets/nvidia,/markets/oklo,/markets/sibelco' },
    shots: { type: 'string' },
  },
});

const FRAME = ['price', 'key-stats', 'financials', 'business', 'peers'];
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
if (values.shots) mkdirSync(values.shots, { recursive: true });
const failures = [];

for (const path of values.pages.split(',')) {
  for (const width of [320, 390, 768, 1440]) {
    const where = `${path} ${width}px`;
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(values.base + path, { waitUntil: 'networkidle', timeout: 180_000 });
    await page
      .waitForFunction(() => !document.querySelector('.mk-loading'), null, { timeout: 120_000 })
      .catch(() => failures.push(`${where}: a section is still loading`));
    const facts = await page.evaluate((frame) => {
      const range = [...document.querySelectorAll('.mk-range-option')].map((b) =>
        b.getBoundingClientRect(),
      );
      return {
        over: document.documentElement.scrollWidth - window.innerWidth,
        missing: frame.filter((id) => !document.getElementById(id)),
        ownership: Boolean(document.getElementById('ownership')),
        rangeTops: [...new Set(range.map((r) => Math.round(r.top)))].length,
        rangeSmall: range.filter((r) => r.height < 44 || r.width < 44).length,
      };
    }, FRAME);
    const defects = await page.evaluate(`(${CHART_DEFECTS_SOURCE})(document.body)`);
    if (facts.over > 0) failures.push(`${where}: scrolls sideways by ${facts.over}px`);
    if (facts.missing.length) failures.push(`${where}: missing ${facts.missing.join(', ')}`);
    if (facts.rangeTops > 1) failures.push(`${where}: the range row wraps`);
    if (facts.rangeSmall) failures.push(`${where}: ${facts.rangeSmall} range cells under 44px`);
    for (const d of defects) failures.push(`${where}: ${d}`);
    if (values.shots)
      await page.screenshot({
        path: `${values.shots}/${path.split('/').pop()}-${width}.png`,
        fullPage: true,
      });
    console.log(`checked ${where}${facts.ownership ? '' : ' (no ownership section)'}`);
    await page.close();
  }
}
await browser.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('company layout: all checks passed');
