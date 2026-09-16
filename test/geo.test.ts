import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_PATHS } from '../config/world-paths';
import { EU_MEMBERS, countryFacts } from '../lib/geo';
import { ROUTES } from '../lib/links';
import { FOOTER_NAV, PUBLIC_NAV, navPaths } from '../config/site-nav';

test('the world atlas has ISO codes for the jurisdictions we actually record', () => {
  const iso = new Set(WORLD_PATHS.map((p) => p.iso2).filter(Boolean));
  // Malta is omitted from the 110m atlas (too small). EU rules still colour it
  // in the facts table; it just has no land path to click.
  for (const code of [
    'us',
    'cn',
    'jp',
    'kr',
    'tw',
    'nl',
    'gb',
    'de',
    'ch',
    ...EU_MEMBERS.filter((c) => c !== 'mt'),
  ]) {
    assert.ok(iso.has(code), `missing land path for ${code}`);
  }
  assert.ok(WORLD_PATHS.length > 150);
});

test('country facts count real instruments onto China and the EU members', () => {
  const facts = countryFacts();
  assert.ok((facts.get('cn')?.instruments ?? 0) > 0);
  assert.ok((facts.get('de')?.instruments ?? 0) > 0, 'EU rules should colour Germany');
  assert.ok(facts.get('cn')?.hasRecord);
});

test('the map is the public geography destination, changelog lives in the footer', () => {
  assert.ok((ROUTES as readonly string[]).includes('/atlas'));
  assert.ok((ROUTES as readonly string[]).includes('/world'));
  assert.ok(PUBLIC_NAV.some((item) => item.href === '/atlas'));
  assert.ok(FOOTER_NAV.some((item) => item.href === '/changelog'));
  assert.ok(navPaths().includes('/atlas'));
});
