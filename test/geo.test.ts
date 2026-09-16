import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_PATHS } from '../config/world-paths';
import { EU_MEMBERS, countryFacts } from '../lib/geo';
import { ROUTES } from '../lib/links';
import { navGroups } from '../config/site-nav';

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

test('the world map is a first-class route and a nav destination', () => {
  assert.ok((ROUTES as readonly string[]).includes('/world'));
  const groups = navGroups({
    bottlenecks: 1,
    organisations: 1,
    rules: 1,
    solutions: 1,
    events: 1,
    notes: 1,
    calls: 1,
    capital: 1,
    learn: 1,
    bindingNow: 1,
  });
  assert.ok(groups.some((g) => g.items.some((i) => i.href === '/world')));
  assert.ok(groups.some((g) => g.items.some((i) => i.href === '/changelog')));
});
