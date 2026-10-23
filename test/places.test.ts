/**
 * The place profiles: a material (/resources/[slug]) and a country
 * (/world/[iso2]). Three promises the pages make and the browser cannot
 * check: every country page's param resolves to a profile and an entity; the
 * fold of export measures by kind drops nothing; and the figures at the top
 * of a material page are the ranking's own figures, not a second count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { entitiesOfKind } from '../lib/entities/registry';
import { modulesFor } from '../lib/profile/modules';
import { resourceProfile } from '../lib/resources/profile';
import { resourceRanking } from '../lib/resources/ranking';
import {
  MEASURE_KINDS,
  countByKind,
  groupByCountry,
  groupByResource,
  measureKind,
} from '../lib/resources/restriction-kinds';
import { restrictionsFor, restrictionsOn } from '../lib/resources/restrictions';
import { resourcesWithData } from '../lib/resources/usgs';
import { countryHref, countryPages, hasCountryPage } from '../lib/world/pages';
import { countryProfile } from '../lib/world/profile';
import { countryHeadline } from '../lib/resources/headline';

test('every country page param resolves to a profile, a name and an entity', () => {
  const pages = countryPages();
  assert.ok(pages.length > 100, `${pages.length} country pages`);
  const entities = new Map(entitiesOfKind('country').map((e) => [e.key, e]));
  for (const iso2 of pages) {
    assert.match(iso2, /^[a-z]{2}$/, iso2);
    const p = countryProfile(iso2);
    assert.ok(p, `${iso2}: no profile`);
    assert.notEqual(p.name, iso2.toUpperCase(), `${iso2}: no display name`);
    const entity = entities.get(iso2);
    assert.ok(entity, `${iso2}: no entity`);
    assert.equal(entity.href, `/world/${iso2}`);
  }
  // The ones the brief names, and the ones the links point at.
  for (const iso2 of ['cn', 'ne', 'us', 'cd', 'id']) assert.ok(hasCountryPage(iso2), iso2);
  assert.equal(countryHref('cn'), '/world/cn');
  assert.equal(countryHref('eu'), '/atlas?view=world&country=eu', 'the EU is not a country page');
});

test('a country profile renders the country modules in reading order', () => {
  const china = entitiesOfKind('country').find((e) => e.key === 'cn');
  assert.ok(china);
  const ids = modulesFor(china).map((m) => m.id);
  for (const expected of [
    'produces',
    'companies',
    'country-rules',
    'access',
    'country-events',
    'discussion',
  ])
    assert.ok(ids.includes(expected), `country profile lost "${expected}"`);
  assert.ok(ids.indexOf('produces') < ids.indexOf('companies'));
  assert.ok(ids.indexOf('country-rules') < ids.indexOf('country-events'));
  assert.ok(ids.at(-1) === 'discussion');
  const p = countryProfile('cn');
  assert.ok(p && p.produces.length > 5 && p.companies.length > 0 && p.instruments.length > 0);
  assert.equal(p.glance.podium, p.produces.filter((r) => r.rank <= 3).length);
  assert.equal(p.glance.companies, p.companies.length);
  assert.equal(p.glance.instruments, p.instruments.length);
  assert.equal(p.glance.events, p.events.length);
});

test('the fold of export measures by kind is exhaustive: no measure dropped, none counted twice', () => {
  const kinds = new Set(MEASURE_KINDS.map((k) => k.id));
  for (const resource of resourcesWithData()) {
    const all = restrictionsOn(resource);
    for (const m of all) assert.ok(kinds.has(measureKind(m)), `${m.type} has no kind`);
    const byKind = countByKind(all);
    assert.equal(byKind.length, MEASURE_KINDS.length, 'every kind is present, even at zero');
    assert.equal(
      byKind.reduce((s, k) => s + k.count, 0),
      all.length,
      `${resource}: kinds do not add up to the measures`,
    );
    const byCountry = groupByCountry(all);
    assert.equal(
      byCountry.reduce((s, c) => s + c.count, 0),
      all.length,
      `${resource}: countries do not add up`,
    );
    for (const c of byCountry)
      assert.equal(
        c.byKind.reduce((s, g) => s + g.lines.length, 0),
        c.count,
        `${resource} ${c.iso2}: a measure fell out of its kind`,
      );
  }
  // The same fold on a country, by resource.
  const cn = restrictionsFor('cn');
  assert.ok(cn.length > 0, 'China restricts something');
  const byResource = groupByResource(cn, (r) => r);
  assert.equal(
    byResource.reduce((s, r) => s + r.count, 0),
    cn.length,
  );
  // A gallium prohibition exists and lands where a reader would look for it.
  const gallium = groupByCountry(restrictionsOn('gallium')).find((c) => c.iso2 === 'cn');
  assert.ok(gallium, 'China is a gallium restrictor in the inventory');
});

test('the at-a-glance figures on a material page are the ranking’s own', () => {
  for (const resource of resourcesWithData()) {
    const profile = resourceProfile(resource);
    const ranking = resourceRanking(resource);
    assert.ok(profile && ranking, resource);
    const p = ranking.production;
    assert.equal(profile.glance.world.text, p.world.text);
    assert.equal(profile.glance.world.year, p.year);
    assert.equal(profile.glance.hhi, p.hhi);
    assert.equal(profile.glance.reservesHhi, ranking.reserves?.hhi ?? null);
    const first = ranking.rows.find((r) => r.production.rank === 1);
    assert.equal(profile.glance.top?.iso2, first?.iso2, `${resource}: top producer`);
    assert.equal(profile.glance.top?.share ?? null, first?.production.share ?? null);
    const restricting = new Set(ranking.rows.filter((r) => r.restrictions > 0).map((r) => r.iso2));
    // The table only lists countries the production or reserves table lists; the
    // inventory can name an exporter outside both, so the glance count is at least the table's.
    assert.ok(profile.glance.restricting >= restricting.size, resource);
    assert.equal(profile.glance.measures, restrictionsOn(resource).length);
    assert.equal(
      profile.production.map((r) => r.iso2).join(','),
      ranking.rows
        .filter((r) => r.production.rank !== null)
        .sort((a, b) => (a.production.rank ?? 0) - (b.production.rank ?? 0))
        .map((r) => r.iso2)
        .join(','),
      `${resource}: chart rows are the ranking's rows`,
    );
  }
  const gallium = resourceProfile('gallium');
  assert.ok(gallium);
  assert.equal(gallium.glance.top?.iso2, 'cn');
  assert.ok(gallium.users.some((u) => u.name === 'Gallium, refined'));
});

test('a headline leads with what the country matters for, never with a small share', () => {
  // Niger IS uranium in the directory; before the WNA table joined, oil at
  // 0.1% (42nd) was the only measured row and led the page.
  const niger = countryHeadline('ne');
  assert.ok(niger, 'Niger has a headline');
  assert.match(niger, /^Largest shares of world output[^:]*: [\d.~<]+% of world uranium/);
  assert.match(niger, /Also produces, small shares: .*oil/);
  const profile = countryProfile('ne');
  assert.ok(profile);
  assert.equal(profile.produces[0].resource, 'uranium');
  assert.ok(profile.produces[0].significant && profile.produces[0].rank <= 10);

  // The United States: substance unchanged — its leading shares still lead.
  const us = countryHeadline('us');
  assert.ok(us && /^Largest shares of world output/.test(us));
  assert.match(us, /natural gas|oil|helium/);

  // Nowhere does a headline start with a share under 1% or a rank past 10th.
  for (const iso2 of countryPages()) {
    const h = countryHeadline(iso2);
    if (!h) continue;
    const m = h.match(
      /^Largest shares of world output[^:]*: ([\d.~<]+)% of world .*?\((\d+)(?:st|nd|rd|th)\)/,
    );
    if (m) {
      const pct = m[1].startsWith('<') ? 0 : Number(m[1].replace('~', ''));
      assert.ok(pct >= 1, `${iso2}: leads with ${m[1]}%`);
      assert.ok(Number(m[2]) <= 10, `${iso2}: leads with rank ${m[2]}`);
    } else {
      assert.match(h, /^Named in the directory|^Also produces, small shares/, `${iso2}: ${h}`);
    }
  }
});
