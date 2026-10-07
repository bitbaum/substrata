/**
 * "What it solves" on the front page is a promise per card: this situation,
 * this answer, this page. A card pointing at a page that does not exist, or
 * two cards sharing an id (React keys, and anything that links to one), would
 * break that promise quietly — so both are held here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PROBLEM_SCALES, WHAT_IT_SOLVES } from '../config/what-it-solves';
import { sitePages } from '../config/site-content';
import { ROUTES, isInternal, pathOf } from '../lib/links';

const STATIC_ROUTES = new Set<string>(ROUTES.filter((r) => !r.includes(':')));
const DOCUMENTS = new Set(sitePages().map((p) => `/${p.path}`));

function served(href: string): boolean {
  if (!isInternal(href)) return false;
  const path = pathOf(href);
  return STATIC_ROUTES.has(path) || DOCUMENTS.has(path);
}

const ITEMS = PROBLEM_SCALES.flatMap((s) => s.items);

test('both scales are present, each with a handful of cards', () => {
  assert.deepEqual(
    PROBLEM_SCALES.map((s) => s.id),
    ['people', 'society'],
  );
  for (const scale of PROBLEM_SCALES) {
    assert.ok(
      scale.items.length >= 4 && scale.items.length <= 6,
      `${scale.id}: ${scale.items.length} cards (keep it to 4–6 so it stays readable)`,
    );
  }
});

test('card ids are unique across the whole section', () => {
  const ids = ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate id in ${ids.join(', ')}`);
});

test('every card and the closing call to action link to a page the site serves', () => {
  const links = [
    ...ITEMS.map((i) => ({ from: i.id, href: i.href })),
    { from: 'cta.primary', href: WHAT_IT_SOLVES.cta.primary.href },
    { from: 'cta.secondary', href: WHAT_IT_SOLVES.cta.secondary.href },
  ];
  const broken = links.filter((l) => !served(l.href)).map((l) => `${l.from}: ${l.href}`);
  assert.deepEqual(broken, [], `links to no page:\n  ${broken.join('\n  ')}`);
});

test('every card says something in each field', () => {
  for (const item of ITEMS) {
    for (const field of ['who', 'problem', 'gives', 'cta'] as const) {
      assert.ok(item[field].trim().length > 0, `${item.id}.${field} is empty`);
    }
  }
});

test('no card writes a count into its copy (counts go stale; pages compute them)', () => {
  for (const item of ITEMS) {
    const digits = `${item.problem} ${item.gives}`.match(/\b\d+\b/g) ?? [];
    // A year is a date, not a count.
    const counts = digits.filter((d) => !/^(19|20)\d\d$/.test(d));
    assert.deepEqual(counts, [], `${item.id} carries a number: ${counts.join(', ')}`);
  }
});
