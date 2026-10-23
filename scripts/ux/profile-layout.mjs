#!/usr/bin/env node
/**
 * A company profile's layout facts, measured in a real browser at the widths
 * a phone has — the same discipline as home-layout.mjs, on three companies
 * that exercise every section: ASML (listed, sole maker, filings), GE Vernova
 * (listed, eight reported series, ownership with four holders) and Sibelco
 * (private, no listing).
 *
 *   node scripts/ux/profile-layout.mjs --base http://localhost:3000
 *
 * Fails when, at 320, 390 and 1440px, light and dark:
 *   - the page scrolls sideways;
 *   - a button, link, summary or field a finger must hit is under 44px in
 *     either direction (inline links inside a sentence are exempt, WCAG 2.5.8);
 *   - a fixed or sticky element other than the top bar, the tab bar and the
 *     section menu exists;
 *   - the five at-a-glance tiles differ in anatomy: every tile has a value and
 *     a label, and tiles in one row share one height;
 *   - a held-bottleneck row's meter does not sit in the same x as the others';
 *   - the section menu is missing, or lists a section the page does not have;
 *   - a word is broken across two lines (more than 6px between its line tops).
 *
 * Needs a Playwright build: set PLAYWRIGHT_CORE to its path if it is not
 * resolvable from here (the fleet keeps one in loki's node_modules), and
 * CHROMIUM_PATH to a browser. Not part of `pnpm run verify`: CI installs no
 * browser. The parts that need none are test/profile.test.ts and
 * test/ownership.test.ts.
 */
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3000' },
    pages: { type: 'string', default: '/markets/asml,/markets/ge-vernova,/markets/sibelco' },
  },
});

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const failures = [];
let where = '';
const fail = (what) => failures.push(`${where}: ${what}`);

for (const path of values.pages.split(',')) {
  for (const [width, scheme] of [320, 390, 1440].flatMap((w) => [
    [w, 'light'],
    [w, 'dark'],
  ])) {
    const phone = width < 768;
    where = `${path} ${width}px ${scheme}`;
    const context = await browser.newContext({
      viewport: { width, height: phone ? 780 : 900 },
      colorScheme: scheme,
    });
    const page = await context.newPage();
    await page.goto(values.base + path, { waitUntil: 'networkidle' });

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
      const targets = [...document.querySelectorAll('a, button, summary, textarea, input, select')]
        .filter(visible)
        // A link inside a sentence is as tall as the sentence; so is one in a
        // caption or a list row's text.
        .filter(
          (el) =>
            !(
              el.closest('p, figcaption, dd, .ck-share-detail, .board-row-plain, h3') &&
              getComputedStyle(el).display === 'inline'
            ),
        )
        // A figure inside a sentence is as tall as the sentence (a button, so
        // the inline-link rule above misses it); one that stands alone wears
        // .figure-target and is measured.
        .filter(
          (el) =>
            !el.classList.contains('figure-trigger') || el.classList.contains('figure-target'),
        )
        // The discussion widget is a package's; its targets are its own gate.
        .filter((el) => !el.closest('.tk-thread, [data-threadkit]'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { label: label(el), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((t) => t.w < 44 || t.h < 44);
      const floating = [...document.querySelectorAll('body *')]
        .filter((el) => ['fixed', 'sticky'].includes(getComputedStyle(el).position) && visible(el))
        .filter(
          (el) =>
            !el.closest(
              '.shell-topbar, .shell-tabbar, .shell-sidebar, [data-shell], .section-nav, .ask-dock',
            ),
        )
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60));
      const tiles = [...document.querySelectorAll('.ck-tiles > li')].map((li) => {
        const r = li.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          h: Math.round(r.height),
          value: Boolean(li.querySelector('.ck-tile-value')?.textContent?.trim()),
          label: Boolean(li.querySelector('.ck-tile-label')?.textContent?.trim()),
        };
      });
      const meters = [...document.querySelectorAll('#chokepoints .board-row-meter')].map((el) =>
        Math.round(el.getBoundingClientRect().right),
      );
      const nav = document.querySelector('.section-nav');
      const navTargets = nav
        ? [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href').slice(1))
        : [];
      const sections = [...document.querySelectorAll('[data-section], [data-section-sub]')].map(
        (h) => h.id,
      );
      const broken = [];
      const walker = document.createTreeWalker(
        document.querySelector('main').parentElement,
        NodeFilter.SHOW_TEXT,
      );
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const host = node.parentElement;
        if (
          !host ||
          !visible(host) ||
          host.closest('[hidden], [popover], script, style, textarea, .ck-line-tip')
        )
          continue;
        for (const m of node.textContent.matchAll(/\S+/g)) {
          // A break at a hyphen is a line break, not a word cut mid-letter.
          if (m[0].length < 4 || m[0].includes('-')) continue;
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0);
          if (
            rects.length > 1 &&
            Math.max(...rects.map((r) => r.top)) - Math.min(...rects.map((r) => r.top)) > 6
          )
            broken.push(m[0]);
        }
      }
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        targets,
        floating,
        tiles,
        meters,
        nav: Boolean(nav && !nav.hidden),
        navTargets,
        sections,
        broken,
      };
    });

    if (facts.overflow > 0) fail(`scrolls sideways by ${facts.overflow}px`);
    for (const t of facts.targets) fail(`target "${t.label}" is ${t.w}x${t.h}`);
    for (const f of facts.floating) fail(`floating element ${f}`);
    if (facts.tiles.length !== 5) fail(`${facts.tiles.length} at-a-glance tiles, not 5`);
    for (const [i, tile] of facts.tiles.entries()) {
      if (!tile.value || !tile.label) fail(`tile ${i + 1} lacks a value or a label`);
    }
    const rows = new Map();
    for (const tile of facts.tiles) rows.set(tile.top, [...(rows.get(tile.top) ?? []), tile.h]);
    for (const [top, heights] of rows)
      if (new Set(heights).size > 1)
        fail(`tiles in the row at ${top}px differ in height: ${heights}`);
    if (new Set(facts.meters).size > 1) fail(`held rows' meters sit at ${facts.meters}`);
    if (!facts.nav) fail('no section menu');
    for (const id of facts.navTargets)
      if (!facts.sections.includes(id))
        fail(`section menu lists "${id}", which the page does not have`);
    for (const w of facts.broken) fail(`word broken across lines: "${w}"`);

    if (phone) {
      // The menu must stay in reach: scrolled to the middle, it is still at the top.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      const stuck = await page.evaluate(() => {
        const nav = document.querySelector('.section-nav');
        if (!nav) return false;
        const r = nav.getBoundingClientRect();
        return r.top >= 0 && r.top < 120;
      });
      if (!stuck) fail('section menu does not stay under the top bar while scrolling');
    }
    await context.close();
  }
}
await browser.close();

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('profile layout: ok');
