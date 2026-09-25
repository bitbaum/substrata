/**
 * The shell's navigation, held to its information architecture and to the
 * fleet navigation contract (fleet SHARED.md, "The navigation contract").
 *
 * Why these numbers. The left panel reached seventeen flat rows and George
 * called it unusable: "too many items … adding cognitive load". The fix was
 * not a new idea but the shell Loki and OrangeCat already settled on, so the
 * limits below are theirs: a handful of sections a reader can hold in their
 * head, a few pages in each, four phone tabs plus More, and the long tail in
 * the ⌘K palette rather than in the panel. Raising a limit here is raising
 * the cognitive load back; do it in a PR that says why.
 *
 * The README table was the doc that went stale last time (it described a
 * megamenu for months after the file was deleted), so it is read here too.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  ACCOUNT_NAV,
  FOOTER_NAV,
  HOME_LINK,
  MOBILE_TABS,
  NAV_ACTION,
  NAV_SECTIONS,
  PALETTE_EXTRA,
  READER_VIEWS,
  RESEARCH_NAV,
  currentHref,
  isCurrent,
  navPaths,
  sectionFor,
} from '../config/site-nav';
import { filterEntries, paletteEntries } from '../components/shell/palette';

const ROOT = process.cwd();

test('the sidebar is a few sections of a few pages, not a list', () => {
  // Home plus five sections: six things visible before anything opens.
  assert.ok(NAV_SECTIONS.length <= 5, `${NAV_SECTIONS.length} sections`);
  for (const section of NAV_SECTIONS) {
    assert.ok(section.items.length >= 2, `${section.label} is not a section`);
    assert.ok(section.items.length <= 4, `${section.label} has ${section.items.length} pages`);
    assert.match(section.question, /\?$/, `${section.label} does not say what it answers`);
  }
});

test('a phone gets four tabs and More, each a research destination', () => {
  assert.equal(MOBILE_TABS.length, 4);
  for (const tab of MOBILE_TABS)
    assert.ok(
      RESEARCH_NAV.some((item) => item.href === tab.href),
      `${tab.label} is a tab but in no section, so "More" cannot show where it sits`,
    );
});

test('every destination carries one line saying what is behind it', () => {
  const all = [
    HOME_LINK,
    ...RESEARCH_NAV,
    ...Object.values(ACCOUNT_NAV),
    ...READER_VIEWS,
    ...FOOTER_NAV,
    ...PALETTE_EXTRA,
    NAV_ACTION,
  ];
  for (const item of all) {
    assert.ok(item.hint.length >= 20, `${item.label} has no useful hint`);
    assert.ok(item.hint.length <= 120, `${item.label}'s hint is a paragraph`);
    assert.match(item.hint, /[.?]$/, `${item.label}'s hint is not a sentence`);
  }
});

test('a page sits in one section, and personal pages in none', () => {
  const seen = new Set<string>();
  for (const item of RESEARCH_NAV) {
    assert.ok(!seen.has(item.href), `${item.href} is in two sections`);
    seen.add(item.href);
  }
  // The desk, settings and inbox are about the reader, not the research:
  // they belong to the account menu (the old sidebar mixed them in).
  for (const personal of Object.values(ACCOUNT_NAV))
    assert.ok(!seen.has(personal.href), `${personal.href} is personal but in the research list`);
});

test('the long tail is one keystroke away: the palette holds every nav path', () => {
  const offered = new Set(paletteEntries({ signedIn: true, reviewer: true }).map((e) => e.href));
  for (const path of navPaths()) assert.ok(offered.has(path), `${path} is not in the palette`);
  const anonymous = paletteEntries({ signedIn: false, reviewer: false }).map((e) => e.href);
  assert.ok(!anonymous.includes(ACCOUNT_NAV.inbox.href), 'the inbox is offered to non-reviewers');
});

test('the palette ranks label matches first and needs every word', () => {
  const entries = paletteEntries({ signedIn: false, reviewer: false });
  assert.equal(filterEntries(entries, 'expo')[0]?.href, '/exposure');
  assert.equal(filterEntries(entries, 'x-ray')[0]?.href, '/xray');
  assert.ok(filterEntries(entries, 'careers training').some((e) => e.href === '/careers/paths'));
  assert.deepEqual(filterEntries(entries, 'zzqx'), []);
  assert.equal(filterEntries(entries, '').length, entries.length);
});

test('the current page is the most specific row, never its parent as well', () => {
  assert.equal(isCurrent('/bottlenecks/euv-lithography-scanners', '/bottlenecks'), true);
  assert.equal(isCurrent('/marketsomething', '/markets'), false);
  assert.equal(isCurrent('/atlas', '/'), false, 'Home would be current on every page');
  assert.equal(currentHref('/careers/paths', RESEARCH_NAV), '/careers/paths');
  assert.equal(currentHref('/careers/some-bottleneck', RESEARCH_NAV), '/careers');
  assert.equal(currentHref('/science/pipeline/x', RESEARCH_NAV), '/science/pipeline');
  assert.equal(sectionFor('/bottlenecks/euv-lithography-scanners')?.id, 'explore');
  assert.equal(sectionFor('/about'), undefined);
});

test('every path the nav can render is a local path, listed once', () => {
  const paths = navPaths();
  assert.equal(new Set(paths).size, paths.length, 'navPaths repeats itself');
  for (const path of paths) assert.match(path, /^\/[a-z0-9/-]*$/, `${path} is not a local path`);
});

test('the README table is the sidebar', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const row = (label: string) =>
    readme
      .split('\n')
      .find((line) => line.startsWith(`| ${label} |`))
      ?.trim();
  for (const section of NAV_SECTIONS) {
    const line = row(section.label);
    assert.ok(line, `README has no row for the "${section.label}" section`);
    const listed = line.match(/`\/[^`]*`/g) ?? [];
    assert.deepEqual(
      listed,
      section.items.map((i) => `\`${i.href}\``),
      `README's ${section.label} row is not the section`,
    );
  }
  const tabs = row('Phone tabs');
  assert.ok(tabs, 'README has no "Phone tabs" row');
  assert.deepEqual(
    tabs.match(/`\/[^`]*`/g),
    MOBILE_TABS.map((t) => `\`${t.href}\``),
  );
});

/**
 * Contract rules 1, 2 and 6, read from the shell's source. Rules 3, 7 and 8
 * need a rendered page and are checked by rendering it at 390, 834 and 1440.
 */
const SHELL_FILES = [
  ...readdirSync(join(ROOT, 'components/shell'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `components/shell/${f}`),
  'components/portal/Shell.tsx',
  'components/portal/AccountMenu.tsx',
];
const source = (file: string) => readFileSync(join(ROOT, file), 'utf8');
/** Each JSX opening tag of the given element, props included. */
function tags(text: string, element: string): string[] {
  return text.match(new RegExp(`<${element}\\b[^>]*?>`, 'gs')) ?? [];
}

test('rule 1: every nav link in the shell can mark itself current', () => {
  for (const file of SHELL_FILES.filter((f) => f.startsWith('components/shell/'))) {
    for (const tag of tags(source(file), 'Link')) {
      if (/brand/.test(tag)) continue; // the wordmark goes home; it is not a nav row
      assert.match(tag, /aria-current=/, `${file}: a Link without aria-current:\n${tag}`);
    }
  }
});

test('rule 2: every toggle that controls a panel says whether it is open', () => {
  for (const file of SHELL_FILES) {
    for (const tag of tags(source(file), 'button')) {
      if (!/aria-controls=|onToggle|toggle/i.test(tag)) continue;
      assert.match(tag, /aria-expanded=/, `${file}: a toggle without aria-expanded:\n${tag}`);
    }
  }
  // Rail flyouts and menus are <details>; DetailsMenu mirrors `open` onto the summary.
  assert.match(source('components/portal/DetailsMenu.tsx'), /setAttribute\('aria-expanded'/);
});

test('rule 6: no internal href is typed into the shell; it comes from config/site-nav', () => {
  for (const file of SHELL_FILES)
    assert.doesNotMatch(source(file), /href="\//, `${file} has a literal internal href`);
});
