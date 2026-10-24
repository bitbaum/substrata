/**
 * Every map country is an instrument jurisdiction, by its ISO2, without a
 * code edit per country — and adding one asserts nothing about its law. The
 * curated ten stay exactly as written; a derived one carries one neutral
 * line, stays out of the policy lists until an enacted rule is recorded, and
 * its page still renders, saying nothing is recorded and where to send a source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import {
  CURATED_JURISDICTIONS,
  DERIVED_JURISDICTION_DETAIL,
  JURISDICTIONS,
  isJurisdictionId,
  jurisdictionById,
} from '../config/substrata-jurisdictions';
import {
  INSTRUMENTS,
  LISTED_JURISDICTIONS,
  POLICY_PAGES,
  instrumentsIn,
  isListedJurisdiction,
  policyTotals,
} from '../config/substrata-policy';
import { COUNTRIES } from '../config/substrata-countries';
import { FACET_SPECS } from '../lib/entry/schemas';
import JurisdictionPage from '../app/policy/[jurisdiction]/page';

test('the curated ten are unchanged: ids, order, names and lines', () => {
  assert.deepEqual(
    JURISDICTIONS.slice(0, 10).map((j) => [j.id, j.short ?? null, j.name, j.detail]),
    [
      [
        'us',
        'US',
        'United States',
        'Sets the export rules most of the chip chain is written against.',
      ],
      [
        'eu',
        'EU',
        'European Union',
        'Trade defence, dual-use controls, and the first broad AI statute.',
      ],
      ['cn', null, 'China', 'Holds the refining and magnet steps, and licenses their export.'],
      [
        'jp',
        null,
        'Japan',
        'Chemistry and precision machinery the rest of the chain qualifies against.',
      ],
      ['kr', null, 'South Korea', 'Memory and wafer capacity.'],
      ['tw', null, 'Taiwan', 'Leading-edge foundry and advanced packaging.'],
      ['nl', null, 'Netherlands', 'The lithography chokepoint sits here.'],
      ['gb', 'UK', 'United Kingdom', 'Research base and grid connection reform.'],
      ['de', null, 'Germany', 'Optics, electrical steel and industrial gases.'],
      ['ch', null, 'Switzerland', 'Where this project is written.'],
    ],
  );
  assert.deepEqual(CURATED_JURISDICTIONS, JURISDICTIONS.slice(0, 10));
  assert.ok(CURATED_JURISDICTIONS.every((j) => !j.derived));
});

test('every map country is a jurisdiction once, and a derived one asserts nothing', () => {
  const ids = JURISDICTIONS.map((j) => j.id);
  assert.equal(new Set(ids).size, ids.length, 'a jurisdiction is listed twice');
  for (const c of COUNTRIES.filter((c) => /^[a-z]{2}$/.test(c.iso2)))
    assert.ok(isJurisdictionId(c.iso2), `${c.iso2} is not a jurisdiction`);
  for (const j of JURISDICTIONS.slice(10)) {
    assert.equal(j.derived, true);
    assert.equal(j.detail, DERIVED_JURISDICTION_DETAIL);
  }
  assert.equal(jurisdictionById('kz')?.name, 'Kazakhstan');
  assert.equal(isJurisdictionId('zz'), false);
  assert.equal(isJurisdictionId('KZ'), false);
});

const instrument = (jurisdiction: string) => ({
  evidence: 'candidate',
  asOf: '2023-05-01',
  source: {
    url: 'https://adilet.zan.kz/eng/docs/K1700000125',
    quote: 'A sentence copied from the law, long enough to pass the quote check.',
    readOn: '2026-10-24',
  },
  submittedBy: { agent: 'data-agent', model: 'test', runId: 'run-0001' },
  id: `${jurisdiction}-subsoil-code`,
  jurisdiction,
  title: 'Code on subsoil and subsoil use',
  body: 'Parliament',
  kind: 'licence-regime',
  status: 'in-force',
  date: '2017-12-27',
  effect: 'mixed',
  summary: 'Sets how exploration and mining licences are granted.',
  technologies: ['energy'],
  industries: ['mining-materials'],
  bottlenecks: [],
  primary: true,
  proponents: [],
});

test('a derived jurisdiction passes the instrument schema add.ts uses; an unknown one does not', () => {
  const { schema } = FACET_SPECS.instruments;
  const kz = schema.safeParse(instrument('kz'));
  assert.ok(kz.success, JSON.stringify(kz.error?.issues));
  assert.equal(kz.data.jurisdiction, 'kz');
  assert.ok(schema.safeParse(instrument('cn')).success, 'a curated one still passes');
  assert.equal(schema.safeParse(instrument('zz')).success, false);
  assert.equal(schema.safeParse(instrument('KZ')).success, false);
});

test('the policy lists and totals are what they were: only curated jurisdictions, three pages', () => {
  assert.deepEqual(policyTotals(), {
    instruments: 12,
    tightening: 9,
    loosening: 2,
    withProponents: 1,
    jurisdictions: 3,
  });
  assert.deepEqual([...POLICY_PAGES], ['us', 'eu', 'cn']);
  assert.deepEqual(LISTED_JURISDICTIONS, CURATED_JURISDICTIONS);
  // A derived country joins the lists only with an adopted or in-force rule.
  for (const j of JURISDICTIONS.slice(10))
    assert.equal(
      isListedJurisdiction(j.id),
      INSTRUMENTS.some(
        (i) => i.jurisdiction === j.id && ['adopted', 'in-force'].includes(i.status),
      ),
    );
});

test('a jurisdiction with nothing recorded renders its page, saying so, with a way to send a source', async () => {
  assert.equal(instrumentsIn(jurisdictionById('kz')!.id).length, 0);
  const element = await JurisdictionPage({ params: Promise.resolve({ jurisdiction: 'kz' }) });
  const { prelude } = await prerenderToNodeStream(element as React.ReactElement);
  let html = '';
  for await (const chunk of prelude) html += String(chunk);
  assert.match(html, /<h1[^>]*>Kazakhstan<\/h1>/);
  assert.ok(html.includes(DERIVED_JURISDICTION_DETAIL));
  assert.match(html, /No rule from Kazakhstan is recorded here yet\./);
  assert.match(html, /not a finding that it has no rules/);
  assert.match(
    html,
    /href="https:\/\/github\.com\/[^"]+\/issues\/new\?[^"]*"[^>]*>Send a source for a rule here/,
  );
  assert.match(html, /href="\/world\/kz"/);
});
