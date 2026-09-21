/**
 * The header, held to what the README says it is.
 *
 * The README has described "three menu groups and one action" since
 * `components/portal/Megamenu.tsx` existed. That file was deleted in 7f59e09,
 * the nav became a flat list of nine, and nothing failed — so the doc and the
 * site disagreed for months, and what shipped was worse than either: links
 * that wrapped onto two rows on a desktop and vanished entirely on a tablet.
 *
 * A README cannot notice that. This can.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DESK_NAV,
  FOOTER_NAV,
  NAV_ACTION,
  NAV_GROUPS,
  RESEARCH_NAV,
  isCurrent,
  navPaths,
} from '../config/site-nav';

const grouped = NAV_GROUPS.flatMap((group) => group.items);

test('three groups and one action, and the groups stay small enough to read', () => {
  assert.equal(NAV_GROUPS.length, 3, 'three groups is the whole menu');
  for (const group of NAV_GROUPS) {
    assert.ok(group.items.length >= 2, `${group.label} is not a group`);
    assert.ok(group.items.length <= 6, `${group.label} has ${group.items.length} items`);
  }
  assert.equal(NAV_ACTION.href, '/join');
});

test('every destination carries one line saying what is behind it', () => {
  for (const item of [...grouped, NAV_ACTION, ...RESEARCH_NAV, ...DESK_NAV]) {
    assert.ok(item.hint.length >= 20, `${item.label} has no useful hint`);
    assert.ok(item.hint.length <= 120, `${item.label}'s hint is a paragraph`);
    assert.match(item.hint, /[.?]$/, `${item.label}'s hint is not a sentence`);
  }
});

test('nothing is reachable from one list and not the other', () => {
  // The desk sidebar and the public header are built from the same link
  // objects. A research destination that is not in a group is one a reader
  // cannot find from the header at all.
  for (const item of RESEARCH_NAV) {
    assert.ok(
      grouped.some((g) => g.href === item.href),
      `${item.label} (${item.href}) is in the research list but in no menu group`,
    );
  }
  for (const item of FOOTER_NAV) {
    assert.ok(
      grouped.some((g) => g.href === item.href) || item.href === NAV_ACTION.href,
      `${item.label} (${item.href}) is in the footer but in no menu group`,
    );
  }
});

test('a destination appears in exactly one group', () => {
  const seen = new Set<string>();
  for (const item of grouped) {
    assert.ok(!seen.has(item.href), `${item.href} is in two groups`);
    seen.add(item.href);
  }
});

test('the README table is the menu', () => {
  // The doc that went stale is the doc this test reads. Changing the groups
  // without changing the README fails here, which is the whole point.
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
  for (const group of NAV_GROUPS) {
    const row = readme
      .split('\n')
      .find((line) => line.startsWith(`| ${group.label} |`))
      ?.trim();
    assert.ok(row, `README has no row for the "${group.label}" group`);
    for (const item of group.items) {
      assert.ok(row.includes(`\`${item.href}\``), `README's ${group.label} row omits ${item.href}`);
    }
    const listed = row.match(/`\/[^`]*`/g) ?? [];
    assert.equal(
      listed.length,
      group.items.length,
      `README's ${group.label} row lists ${listed.length} routes, the menu has ${group.items.length}`,
    );
  }
  assert.match(readme, /\| Action \| `\/join` \|/);
});

test('current-path matching covers a section, not just its index', () => {
  assert.equal(isCurrent('/bottlenecks', '/bottlenecks'), true);
  assert.equal(isCurrent('/bottlenecks/euv-lithography-scanners', '/bottlenecks'), true);
  // The trap this replaced: `startsWith` without the slash marks /marketsomething.
  assert.equal(isCurrent('/marketsomething', '/markets'), false);
  assert.equal(isCurrent('/', '/bottlenecks'), false);
});

test('every path the nav can render is a local path, listed once', () => {
  const paths = navPaths();
  assert.equal(new Set(paths).size, paths.length, 'navPaths repeats itself');
  for (const path of paths) assert.match(path, /^\/[a-z0-9/-]*$/, `${path} is not a local path`);
  for (const item of grouped)
    assert.ok(paths.includes(item.href), `${item.href} is not in navPaths`);
});
