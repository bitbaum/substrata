/**
 * Each adapter against its recorded real responses (test/fixtures/sources):
 * what it reads, the rows it proposes, and — as much the point — what it
 * refuses to turn into a row and why. No network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runComtrade } from '../lib/sources/comtrade';
import { findCik, runEdgar } from '../lib/sources/edgar';
import { customerHits, holderHits } from '../lib/sources/edgar-text';
import { companyEndpoint, countryEndpoint } from '../lib/sources/endpoints';
import { runGleif } from '../lib/sources/gleif';
import {
  findReportPdfs,
  kazatompromDrafts,
  runKazatomprom,
  KAP_ENDPOINT,
} from '../lib/sources/kazatomprom';
import { adapterRun, finalise } from '../lib/sources/proposal';
import { runWikidata } from '../lib/sources/wikidata';
import { RelationEntry } from '../lib/entry/relation-schema';
import { fixtureText, offline } from './sources-fixtures';

const by = (a: string) => adapterRun(a, 'fixture-run');

function everyRowIsAGoodCandidate(rows: unknown[], adapter: string) {
  for (const row of rows) {
    assert.ok(RelationEntry.safeParse(row).success, JSON.stringify(row));
    const r = row as { provenance: { adapter: string; url: string }; source: { url: string } };
    assert.equal(r.provenance.adapter, adapter);
    assert.equal(r.provenance.url, r.source.url);
  }
}

test('endpoints resolve exact names only, and say why not', () => {
  assert.deepEqual(companyEndpoint('Cameco Corp.'), { id: 'company:cameco-corp' });
  assert.deepEqual(
    companyEndpoint('Cameco'),
    { id: 'company:cameco-corp' },
    'legal suffix dropped',
  );
  assert.equal(companyEndpoint('Shenghe').id, null, 'a short form is not the directory firm');
  assert.equal(countryEndpoint('Russian Federation'), 'country:ru');
  assert.equal(countryEndpoint('the Americas'), undefined);
});

test('comtrade: Kazakhstan’s uranium exports become ships_to rows with the net weight', async () => {
  const r = await runComtrade(
    { reporterIso2: 'kz', hs: '284410', period: '2024', top: 2 },
    by('comtrade'),
    offline,
  );
  assert.deepEqual(
    r.rows.map((x) => [x.to, x.volume?.value, x.grade]),
    [
      ['country:cn', 11224600, 'stated'],
      ['country:ru', 9974990, 'stated'],
    ],
  );
  assert.ok(r.rows[0].source.url.endsWith('partnerCode=156'));
  assert.match(r.rows[0].source.quote, /^"cmdCode":"284410".*"netWgt":11224600\.0$/);
  everyRowIsAGoodCandidate(r.rows, 'comtrade');
});

test('kazatomprom: the newest reports are found on the IR pages, not remembered', () => {
  const annual = findReportPdfs(fixtureText('kazatomprom-annual-links.html'), 'annual-report');
  assert.equal(annual[0].url, 'https://www.kazatomprom.kz/storage/6c/kap_ir_2025_encjwwsl.pdf');
  const updates = findReportPdfs(fixtureText('kazatomprom-updates-links.html'), 'trading-update');
  assert.deepEqual([updates[0].year, updates[0].quarter], [2026, 2]);
  assert.ok(
    updates.some((u) => u.year === 2019 && u.quarter === 1),
    'older naming schemes parse too',
  );
});

test('kazatomprom: the 2025 report page states two destination countries and names two converters', () => {
  const report = {
    kind: 'annual-report' as const,
    url: 'https://www.kazatomprom.kz/storage/6c/kap_ir_2025_encjwwsl.pdf',
    year: 2025,
  };
  const page = fixtureText('kazatomprom-ir2025-p17.txt');
  const pages = [...Array(16).fill(''), page];
  const { drafts, skipped } = kazatompromDrafts(pages, report);
  const docs = new Map([
    [
      report.url,
      {
        ok: true as const,
        url: report.url,
        kind: 'pdf' as const,
        text: pages.join('\n'),
        pages,
        fetchedAt: '2026-10-24T06:13:25.133Z',
      },
    ],
  ]);
  const { rows } = finalise(drafts, {
    adapter: 'kazatomprom',
    docs,
    submittedBy: by('kazatomprom'),
    ceiling: 'stated',
  });
  assert.deepEqual(
    rows.map((x) => [x.from, x.to, x.grade, x.source.locator]),
    [
      [KAP_ENDPOINT, 'country:cn', 'stated', 'page 17'],
      [KAP_ENDPOINT, 'country:ru', 'stated', 'page 17'],
      [KAP_ENDPOINT, 'company:cameco-corp', 'lead', 'page 17'],
      [KAP_ENDPOINT, 'company:orano', 'lead', 'page 17'],
    ],
  );
  assert.ok(
    rows.every((x) => !x.volume),
    'no volume: the report states none per destination',
  );
  assert.ok(skipped.some((s) => /Solstice/.test(s.record)));
  assert.ok(skipped.some((s) => /regions are not entities/.test(s.reason)));
  everyRowIsAGoodCandidate(rows, 'kazatomprom');
});

test('kazatomprom: the trading update names only regions, so it yields no row; an unrecorded report is skipped', async () => {
  const r = await runKazatomprom(by('kazatomprom'), {}, offline);
  assert.equal(r.rows.length, 0);
  assert.ok(r.skipped.some((s) => /Asia, Europe, and the Americas/.test(s.record)));
  assert.ok(r.skipped.some((s) => /kap_ir_2025/.test(s.record) && /404/.test(s.reason)));
});

test('gleif: Shin-Etsu Chemical owns Shin-Etsu Handotai, from the relationship record', async () => {
  const r = await runGleif('353800AARAPM3AYH4I04', by('gleif'), {}, offline);
  assert.deepEqual(
    r.rows.map((x) => [x.from, x.type, x.to, x.grade]),
    [['company:shin-etsu-chemical', 'owns', 'company:shin-etsu-handotai', 'stated']],
  );
  assert.match(r.rows[0].source.quote, /IS_DIRECTLY_CONSOLIDATED_BY","status":"ACTIVE"$/);
  everyRowIsAGoodCandidate(r.rows, 'gleif');
});

test('gleif: Kazatomprom’s parent is read but not guessed onto the site', async () => {
  const r = await runGleif('5493008JG5TXJP2JSY44', by('gleif'), { subject: KAP_ENDPOINT }, offline);
  assert.equal(r.rows.length, 0);
  assert.match(r.skipped[0].reason, /SAMRUK-KAZYNA/);
});

test('wikidata: a lead on its own, stated only when a second source agrees', async () => {
  const alone = await runWikidata(
    'Q15108623',
    by('wikidata'),
    { subject: 'company:carl-zeiss-smt' },
    offline,
  );
  assert.deepEqual(
    alone.rows.map((x) => [x.from, x.to, x.grade]),
    // Carl Zeiss AG is a stub company (named by an SEC filing row as a holder
    // of Carl Zeiss SMT), so it is now an endpoint the adapter may name.
    [
      ['company:carl-zeiss-ag', 'company:carl-zeiss-smt', 'lead'],
      ['company:asml', 'company:carl-zeiss-smt', 'lead'],
    ],
  );
  assert.match(alone.rows[0].source.url, /Special:EntityData\/Q15108623\.json$/);
  const agreed = await runWikidata(
    'Q15108623',
    by('wikidata'),
    {
      subject: 'company:carl-zeiss-smt',
      agrees: (k) => k === 'company:asml|owns|company:carl-zeiss-smt',
    },
    offline,
  );
  assert.equal(agreed.rows.find((x) => x.from === 'company:asml')?.grade, 'stated');
  assert.ok(alone.skipped.some((s) => /no relation type for "country"/.test(s.reason)));
  everyRowIsAGoodCandidate(alone.rows, 'wikidata');
});

test('edgar: MP Materials’ proxy names Hancock Prospecting at 7.8%; the rest stay records', async () => {
  assert.deepEqual(await findCik('MP Materials', offline), [1801368]);
  assert.deepEqual(await findCik('mp', offline), [1801368]);
  const r = await runEdgar(1801368, 'company:mp-materials', by('edgar'), offline);
  const holders = r.records
    .filter((x) => x.kind === 'holder')
    .map((x) => [x.hit.name, x.hit.percent]);
  assert.deepEqual(holders, [
    ['Hancock Prospecting Pty Limited', 7.8],
    ['The Vanguard Group', 7.7],
    ['James H. Litinsky', 7.2],
    ['BlackRock, Inc.', 6.7],
  ]);
  assert.ok(
    r.records.some((x) => x.kind === 'customer' && x.hit.name === 'Shenghe'),
    'read, but "Shenghe" alone is not the directory firm',
  );
  // Hancock Prospecting is a graph node (a USGS owner string) and BlackRock a
  // stub company (named as a holder in the corpus's ownership rows); the
  // other two are not on the site.
  assert.deepEqual(
    r.rows.map((x) => [x.from, x.type, x.to, x.share?.value, x.asOf, x.source.quote]),
    [
      [
        'company:hancock-prospecting-pty-ltd',
        'owns',
        'company:mp-materials',
        7.8,
        '2026-04-24',
        'Hancock Prospecting Pty Limited (1) 13,861,212 7.8%',
      ],
      [
        'company:blackrock',
        'owns',
        'company:mp-materials',
        6.7,
        '2026-04-24',
        'BlackRock, Inc. (4) 11,930,482 6.7%',
      ],
    ],
  );
  assert.equal(r.skipped.filter((s) => /holder/.test(s.record)).length, 2);
  everyRowIsAGoodCandidate(r.rows, 'edgar');
});

test('edgar text: a named customer that is an entity becomes a hit with its sentence', () => {
  const text =
    'Revenue was concentrated. Sales to Shenghe Resources accounted for most of the year. Customer A accounted for 30 % of the Company’s total revenue.';
  const hits = customerHits(text);
  assert.equal(hits[0].endpoint, 'company:shenghe-resources');
  assert.equal(hits[0].quote, 'Sales to Shenghe Resources accounted for most of the year.');
  assert.ok(!hits.some((h) => h.name.startsWith('Customer')), 'anonymised customers are not names');
  assert.deepEqual(
    holderHits(
      '5% or Greater Stockholders Lynas Rare Earths (1) 1,000,000 9.1% Named Executive Officers',
    ),
    [
      {
        name: 'Lynas Rare Earths',
        endpoint: 'company:lynas-rare-earths',
        quote: 'Lynas Rare Earths (1) 1,000,000 9.1%',
        percent: 9.1,
      },
    ],
  );
});
