/**
 * The one test this site needs: its entire content validates against the
 * shared schema it is rendered with.
 *
 * This is the extraction's contract running in reverse — substrata is
 * sitekit's reference consumer, so a schema change that would break this site
 * fails HERE, in this repo's CI, before it ships to any generated site. It
 * also replaces a `jest --passWithNoTests` that had never actually run: jest
 * was never a dependency of this repo, so `verify`'s test gate was a no-op on
 * every fresh install.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateSite } from 'sitekit';
import { siteChrome, sitePages, siteNavItems } from '../config/site-content';

test('the whole site validates against the sitekit schema', () => {
  const result = validateSite({ chrome: siteChrome(), pages: sitePages() });
  if (!result.success) {
    assert.fail(`schema violations:\n${result.errors.join('\n')}`);
  }
});

test('every nav item resolves to a page that exists', () => {
  const pages = sitePages();
  const paths = new Set(pages.map((p) => p.path));
  for (const item of siteNavItems(pages)) {
    assert.ok(paths.has(item.path), `nav points at missing page '${item.path}'`);
  }
});

test('the chrome carries the canonical host for the footer', () => {
  assert.equal(siteChrome().host, 'substrata.ch');
});
