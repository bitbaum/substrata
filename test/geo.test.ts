import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_PATHS } from '../config/world-paths';
import { EU_MEMBERS, countryDossier, countryFacts } from '../lib/geo';
import { ROUTES } from '../lib/links';
import { FOOTER_NAV, PUBLIC_NAV, RESEARCH_NAV, navPaths } from '../config/site-nav';

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

test('Niger and Argentina are dossiers, not blank panels', () => {
  const niger = countryDossier('ne');
  const argentina = countryDossier('ar');
  assert.ok(niger);
  assert.ok(argentina);
  assert.ok(niger.resources.some((r) => r.id === 'uranium'));
  assert.ok(argentina.resources.some((r) => r.id === 'lithium'));
  assert.match(niger.why, /uranium/i);
  assert.match(argentina.why, /lithium/i);
  assert.ok(niger.relatedBottlenecks.length > 0);
  assert.ok(argentina.relatedBottlenecks.length > 0);
});

test('country facts count real instruments onto China and the EU members', () => {
  const facts = countryFacts();
  assert.ok((facts.get('cn')?.instruments ?? 0) > 0);
  assert.ok((facts.get('de')?.instruments ?? 0) > 0, 'EU rules should colour Germany');
  assert.ok(facts.get('cn')?.hasRecord);
});

test('research destinations stay in both the public bar and the desk list', () => {
  assert.ok((ROUTES as readonly string[]).includes('/atlas'));
  assert.ok((ROUTES as readonly string[]).includes('/world'));
  for (const href of [
    '/atlas',
    '/bottlenecks',
    '/markets',
    '/policy',
    '/science',
    '/capital',
    '/learn',
    '/events',
    '/talent',
  ]) {
    assert.ok(
      RESEARCH_NAV.some((item) => item.href === href),
      `missing from RESEARCH_NAV: ${href}`,
    );
    assert.ok(
      PUBLIC_NAV.some((item) => item.href === href),
      `missing from public nav: ${href}`,
    );
  }
  assert.ok(FOOTER_NAV.some((item) => item.href === '/changelog'));
  assert.ok(navPaths().includes('/atlas'));
});
