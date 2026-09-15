/**
 * The sections — taxonomy, markets, policy, science — all point at the same
 * universe. These tests are what stop them drifting apart: a name typed into
 * one file that does not exist in another fails the build rather than
 * rendering as a dead link.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MATERIALS } from '../config/substrata';
import { CHOKEPOINTS } from '../config/substrata-coverage';
import { JURISDICTIONS, INSTRUMENTS, RECOMMENDATIONS } from '../config/substrata-policy';
import { READINESS_SCALE, SCIENCE, readinessBand } from '../config/substrata-science';
import {
  CLASSIFICATION,
  INDUSTRIES,
  TECHNOLOGIES,
  classificationFor,
} from '../config/substrata-taxonomy';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { MARKET_PARTICIPANTS, marketTotals, participantBySlug } from '../lib/participants';
import { navGroups, navPaths } from '../config/site-nav';
import { sitePages } from '../config/site-content';

const UNIVERSE = new Set<string>([
  ...MATERIALS.map((m) => m.title),
  ...CHOKEPOINTS.map((c) => c.name),
]);
const TECH_IDS = new Set(TECHNOLOGIES.map((t) => t.id));
const INDUSTRY_IDS = new Set(INDUSTRIES.map((i) => i.id));
const JURISDICTION_IDS = new Set(JURISDICTIONS.map((j) => j.id));

test('every bottleneck is classified once, in plain English, under a real technology and industry', () => {
  for (const name of UNIVERSE) {
    const c = classificationFor(name);
    assert.ok(c.plain.length > 30, `${name}: plain line too short to help anyone`);
    assert.ok(
      !/\bEUV\b|\bHBM\b|\bGOES\b|\bREBCO\b|\bPGM\b/.test(c.plain),
      `${name}: plain line uses an acronym`,
    );
    assert.ok(c.technologies.length > 0, `${name}: no technology`);
    assert.ok(c.industries.length > 0, `${name}: no industry`);
    for (const t of c.technologies) assert.ok(TECH_IDS.has(t), `${name}: unknown technology ${t}`);
    for (const i of c.industries) assert.ok(INDUSTRY_IDS.has(i), `${name}: unknown industry ${i}`);
  }
  for (const name of Object.keys(CLASSIFICATION)) {
    assert.ok(UNIVERSE.has(name), `classification for unknown bottleneck: ${name}`);
  }
});

test('the bottleneck model carries the classification through to the page', () => {
  for (const b of BOTTLENECKS) {
    assert.equal(b.plain, classificationFor(b.name).plain);
    assert.ok(b.technologies.length > 0 && b.industries.length > 0, b.name);
  }
});

test('every producer row appears in markets, and every market row is reachable', () => {
  const totals = marketTotals();
  assert.ok(totals.organisations >= 100, 'the directory lost rows in the join');
  for (const b of BOTTLENECKS) {
    for (const producer of b.producers) {
      const record = MARKET_PARTICIPANTS.find((p) => p.name === producer.name);
      assert.ok(record, `${producer.name} makes ${b.name} but has no market record`);
      assert.ok(
        record.produces.some((x) => x.bottleneck === b.name),
        `${producer.name} is missing ${b.name}`,
      );
    }
  }
  const slugs = MARKET_PARTICIPANTS.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'two organisations share a slug');
  for (const slug of slugs) assert.ok(participantBySlug(slug), slug);
});

test('a market row never claims evidence the coverage file does not have', () => {
  for (const p of MARKET_PARTICIPANTS) {
    const verified = p.produces.filter((x) => x.verification === 'sourced');
    assert.equal(p.hasVerifiedRow, verified.length > 0, p.name);
    for (const row of verified) assert.ok(row.source, `${p.name}: verified with no source`);

    // The existence source is derived, never asserted: a row may only claim it
    // where a maker row actually carries a URL. The replaceability grade is a
    // judgement and is deliberately never sourced this way.
    if (p.existenceVerifiedBy) {
      assert.ok(verified.length > 0, `${p.name}: claims a source with no verified maker row`);
      assert.match(p.existenceVerifiedBy.url, /^https?:\/\//, `${p.name}: existence source`);
      assert.ok(
        verified.some((row) => row.source === p.existenceVerifiedBy?.url),
        `${p.name}: existence source is not one of its own maker rows`,
      );
    } else {
      assert.equal(verified.length, 0, `${p.name}: has a verified row but claims no source`);
    }
  }
  const totals = marketTotals();
  assert.equal(
    totals.existenceVerified,
    MARKET_PARTICIPANTS.filter((p) => p.existenceVerifiedBy !== null).length,
  );
  assert.ok(
    totals.existenceVerified < totals.organisations,
    'the directory is not fully sourced, and should not claim to be',
  );
});

test('every policy instrument is dated, sourced, and points at real things', () => {
  const ids = INSTRUMENTS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'an instrument id is repeated');
  for (const i of INSTRUMENTS) {
    assert.match(i.date, /^\d{4}-\d{2}-\d{2}$/, `${i.id}: date`);
    assert.match(i.readOn, /^\d{4}-\d{2}-\d{2}$/, `${i.id}: readOn`);
    assert.ok(JURISDICTION_IDS.has(i.jurisdiction), `${i.id}: unknown jurisdiction`);
    for (const name of i.bottlenecks)
      assert.ok(UNIVERSE.has(name), `${i.id}: unknown bottleneck ${name}`);
    for (const t of i.technologies) assert.ok(TECH_IDS.has(t), `${i.id}: unknown technology ${t}`);
    for (const ind of i.industries)
      assert.ok(INDUSTRY_IDS.has(ind), `${i.id}: unknown industry ${ind}`);
    assert.ok(i.summary.length > 20, `${i.id}: summary too thin`);
    // A status that is not simply "in force" owes the reader an explanation.
    if (i.status !== 'in-force') {
      assert.ok(i.statusNote, `${i.id}: status ${i.status} with no note explaining it`);
    }
  }
});

test('every recommendation names a decider and what would prove it wrong', () => {
  for (const r of RECOMMENDATIONS) {
    assert.ok(JURISDICTION_IDS.has(r.jurisdiction), `${r.id}: unknown jurisdiction`);
    assert.ok(r.decider.length > 5, `${r.id}: no decider`);
    assert.ok(r.falsifier.length > 30, `${r.id}: falsifier too thin`);
    for (const name of r.bottlenecks)
      assert.ok(UNIVERSE.has(name), `${r.id}: unknown bottleneck ${name}`);
  }
});

test('every science entry relieves a real bottleneck and sits on the scale', () => {
  const ids = SCIENCE.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'a science id is repeated');
  const levels = new Set(READINESS_SCALE.map((s) => s.level));
  for (const entry of SCIENCE) {
    assert.ok(TECH_IDS.has(entry.front), `${entry.id}: unknown front`);
    assert.ok(
      levels.has(entry.readiness),
      `${entry.id}: readiness ${entry.readiness} off the scale`,
    );
    assert.ok(['lab', 'proving', 'production'].includes(readinessBand(entry.readiness)));
    assert.ok(entry.relieves.length > 0, `${entry.id}: relieves nothing`);
    for (const relief of entry.relieves) {
      assert.ok(
        UNIVERSE.has(relief.bottleneck),
        `${entry.id}: unknown bottleneck ${relief.bottleneck}`,
      );
      assert.ok(relief.mechanism.length > 30, `${entry.id}: mechanism too thin to check`);
    }
  }
});

test('every navigation entry resolves to a route that exists', () => {
  const documents = new Set(sitePages().map((p) => p.path));
  const routes = new Set([
    '',
    'bottlenecks',
    'markets',
    'policy',
    'science',
    'research',
    'events',
    'notes',
    'join',
    'calls',
    'api/map',
  ]);
  const groups = navGroups({
    bottlenecks: 1,
    organisations: 1,
    rules: 1,
    solutions: 1,
    events: 1,
    notes: 1,
    calls: 1,
    bindingNow: 1,
  });
  for (const href of navPaths(groups)) {
    const path = href.replace(/^\//, '');
    assert.ok(
      documents.has(path) || routes.has(path),
      `navigation points at a missing route: ${href}`,
    );
  }
  // Every group and item has a blurb: the menu explains itself or it is not a menu.
  for (const group of groups) {
    assert.ok(group.blurb.length > 20, `${group.id}: no blurb`);
    for (const item of group.items) {
      assert.ok(item.blurb.length > 20, `${group.id}/${item.label}: no blurb`);
    }
  }
});
