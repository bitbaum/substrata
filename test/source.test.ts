/**
 * What counts as a producer-sourcing candidate is decided in `lib/source.ts`,
 * shared between the hand-run script and the scheduled run. These tests hold
 * the pure judgement — the network call (`examineRow`) is exercised by hand,
 * same as `sweep()` in `lib/sweep.ts` is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  looksLikeOwnDomain,
  matchOnPage,
  nameStem,
  normalise,
  queryFor,
  readOrder,
  unsourcedRows,
} from '../lib/source';
import { COVERAGE } from '../config/substrata-coverage';

test('every unsourced row really has no source, and points at a real material', () => {
  const materials = new Set(COVERAGE.map((c) => c.material));
  for (const { material, producer } of unsourcedRows()) {
    assert.equal(producer.source, null, `${producer.name} has a source but was queued`);
    assert.ok(materials.has(material), `${material} is not a coverage material`);
  }
});

test('normalise collapses every dash a page might use, and diacritics', () => {
  assert.equal(normalise('Sibanye-Stillwater'), 'sibanye stillwater');
  assert.equal(normalise('Sibanye‑Stillwater'), 'sibanye stillwater'); // non-breaking hyphen
  assert.equal(normalise('Sibanye—Stillwater'), 'sibanye stillwater'); // em dash
  assert.equal(normalise('Société'), 'societe');
});

test('nameStem drops the corporate suffix so the stem appears in prose', () => {
  assert.equal(nameStem('PT Timah'), 'Timah');
  assert.equal(nameStem('Malaysia Smelting Corporation'), 'Malaysia Smelting');
  // Long enough after stripping to keep, even with the trailing punctuation
  // the suffix regex leaves behind — a pre-existing quirk of the extraction,
  // not something this test is asserting is ideal.
  assert.equal(nameStem('5N Plus Inc.'), '5N Plus .');
  // Too short after stripping — keep the original rather than search for "5N".
  assert.equal(nameStem('5N Ltd'), '5N Ltd');
});

test('queryFor quotes the company and adds the trade term', () => {
  const q = queryFor('Sibanye-Stillwater', 'Ruthenium, sputtering and ALD grade');
  assert.match(q, /^"Sibanye-Stillwater" /);
  assert.match(q, /ruthenium/i);
});

test('a company-owned domain is recognised even through a suffix', () => {
  assert.equal(looksLikeOwnDomain('https://www.ferrotec.com/about/', ['Ferrotec']), true);
  assert.equal(
    looksLikeOwnDomain('https://quartz.ferrotec.com/', ['Ferrotec']),
    true,
    'a subdomain still carries the company token',
  );
  assert.equal(
    looksLikeOwnDomain('https://www.miningweekly.com/article/x', ['Sibanye-Stillwater']),
    false,
  );
  assert.equal(looksLikeOwnDomain('not a url', ['Ferrotec']), false);
});

test("readOrder puts the company's own pages first, without dropping the rest", () => {
  const results = [
    { title: 'News', url: 'https://www.miningweekly.com/a', snippet: '' },
    { title: 'Own site', url: 'https://www.ferrotec.com/products/', snippet: '' },
    { title: 'Forum', url: 'https://reddit.com/r/x', snippet: '' },
  ];
  const ordered = readOrder(results, ['Ferrotec']);
  assert.equal(ordered.length, 3);
  assert.equal(ordered[0]?.url, 'https://www.ferrotec.com/products/');
});

test('a page counts only when the name and a material term share one window', () => {
  const material = 'Crucible-grade high-purity quartz sand';
  const page =
    'Ferrotec is a diversified industrial group. '.repeat(20) +
    'Ferrotec offers fabricated quartzware for semiconductor OEMs, drawing on decades of crucible-grade quartz experience.' +
    ' Elsewhere the group also makes thermoelectric modules.'.repeat(20);
  const match = matchOnPage(page, ['Ferrotec'], material);
  assert.ok(match, 'name and material term appear together and should match');
  assert.match(match!.excerpt, /quartz/i);
  assert.ok(match!.matched.includes('Ferrotec'));
});

test('a page naming both, far apart, is not a match', () => {
  const material = 'Crucible-grade high-purity quartz sand';
  const page =
    'Ferrotec makes thermoelectric modules and power semiconductor devices. ' +
    'x'.repeat(2000) +
    ' Somewhere else entirely, unrelated crucible-grade quartz sand is discussed in general.';
  assert.equal(matchOnPage(page, ['Ferrotec'], material), null);
});
