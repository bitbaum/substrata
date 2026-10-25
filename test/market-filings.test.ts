/**
 * Fundamentals (SEC XBRL company facts) and holders (proxy tables, Schedules
 * 13G/13D, Forms 4) on recorded responses: what is read, what is cited, and
 * the remainder that says what it is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fixture, MARKET_DEPS } from './market-fixtures';
import { bySlug } from '../lib/market-data/identity';
import {
  allMetrics,
  annualGrowth,
  type CompanyFacts,
  type MetricSeries,
} from '../lib/market-data/fundamentals/xbrl';
import { buildFundamentals, fundamentals } from '../lib/market-data/fundamentals/read';
import { parseProxyTable } from '../lib/market-data/holders/proxy';
import {
  parseSchedule13Xml,
  percentFromText,
  rawXmlUrl,
} from '../lib/market-data/holders/schedule13';
import { ownerName, parseForm4 } from '../lib/market-data/holders/insiders';
import { buildHolders } from '../lib/market-data/holders/build';
import { holders } from '../lib/market-data/holders/read';
import { resetSnapshots } from '../lib/market-data/snapshots';
import { ownershipView } from '../lib/ownership';
import { resetPacing } from '../lib/sources/http';

const facts = (file: string) => JSON.parse(fixture(file)) as CompanyFacts;
const series = (cf: CompanyFacts, id: string) =>
  allMetrics(cf).find((m) => m.metric === id) as MetricSeries;

test('NVIDIA revenue: annual from 10-Ks, cited to the filing, with growth computed', () => {
  const rev = series(facts('companyfacts-nvda.json'), 'revenue');
  assert.equal(rev.unit, 'USD');
  const last = rev.annual.at(-1)!;
  assert.equal(last.end, '2026-01-25');
  assert.equal(last.value, 215_938_000_000);
  assert.equal(last.form, '10-K');
  assert.equal(last.accession, '0001045810-26-000021');
  assert.equal(
    last.url,
    'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/0001045810-26-000021-index.htm',
  );
  assert.equal(last.concept, 'us-gaap:Revenues');
  assert.ok(rev.quarterly.length > 0 && rev.quarterly.every((q) => q.form.startsWith('10-Q')));
  const g = annualGrowth(rev).at(-1)!;
  assert.equal(g.to.end, '2026-01-25');
  assert.equal(g.display, `+${((215_938_000_000 / g.from.value - 1) * 100).toFixed(1)}%`);
});

test('TSMC files IFRS in TWD, annual only, and says why there are no quarters', () => {
  const f = buildFundamentals(facts('companyfacts-tsmc.json'), '2026-10-25T00:00:00Z');
  const rev = f.metrics.find((m) => m.metric === 'revenue') as MetricSeries;
  assert.equal(rev.unit, 'TWD');
  assert.equal(rev.annual.at(-1)!.concept, 'ifrs-full:Revenue');
  assert.equal(rev.annual.at(-1)!.form, '20-F');
  assert.equal(rev.quarterly.length, 0);
  assert.match(f.notes[0], /Form 6-K, which carries no XBRL/);
});

test('no figure is a blank: a company outside the SEC, and one the API has nothing for, are typed', async () => {
  const tel = await fundamentals(bySlug('tokyo-electron')!);
  assert.ok('unavailable' in tel);
  assert.match(tel.reason, /does not file financial statements with the SEC/);
  resetSnapshots();
  resetPacing();
  const se = await fundamentals(bySlug('siemens-energy')!, MARKET_DEPS);
  assert.ok('unavailable' in se);
  assert.match(se.reason, /no XBRL financial data .* 404/);
});

test('proxy tables: holders with a percentage, the group row, the record date', () => {
  const nv = parseProxyTable(fixture('proxy-nvidia.txt'))!;
  assert.equal(nv.asOf, '2026-03-23');
  assert.equal(nv.sharesOutstanding, 24_312_141_810);
  assert.deepEqual(
    nv.rows.map((r) => [r.name, r.percent, r.group]),
    [
      ['Jen-Hsun Huang', 3.58, false],
      ['Directors and executive officers as a group', 3.94, true],
      ['BlackRock, Inc.', 7.43, false],
      ['Vanguard Capital Management', 7.31, false],
    ],
  );
  const expected: Record<string, [string, number][]> = {
    amd: [
      ['Vanguard Group', 8.8],
      ['BlackRock, Inc.', 7.7],
    ],
    'ge-vernova': [
      ['FMR LLC', 8.7],
      ['Vanguard Group', 8.7],
      ['BlackRock, Inc.', 6.5],
    ],
    microsoft: [
      ['Vanguard Capital Management LLC', 7.48],
      ['BlackRock, Inc.', 7.3],
    ],
    tesla: [
      ['Elon Musk', 19.8],
      ['Vanguard Capital Management', 5.3],
      ['Directors and executive officers as a group', 20],
    ],
    amazon: [
      ['Jeffrey P. Bezos', 8.8],
      ['Vanguard Group, Inc.', 7.2],
      ['BlackRock, Inc.', 5.9],
      ['Directors and executive officers as a group', 8.9],
    ],
  };
  for (const [slug, rows] of Object.entries(expected))
    assert.deepEqual(
      parseProxyTable(fixture(`proxy-${slug}.txt`))!.rows.map((r) => [r.name, r.percent]),
      rows,
      slug,
    );
});

test('Schedule 13G XML: the issuer is checked, a 0% amendment is read as 0', () => {
  const zero = parseSchedule13Xml(fixture('nvda-13g-vanguard-zero.xml'))!;
  assert.equal(zero.issuerCik, 1045810);
  assert.equal(zero.percent, 0);
  assert.equal(zero.eventDate, '2026-03-13');
  assert.match(zero.comment!, /internal realignment/);
  const vcm = parseSchedule13Xml(fixture('nvda-13g-vcm.xml'))!;
  assert.deepEqual(
    [vcm.holder, vcm.percent, vcm.shares, vcm.eventDate],
    ['Vanguard Capital Management', 7.31, 1_777_408_252, '2026-03-31'],
  );
  const filedByNvidia = parseSchedule13Xml(fixture('nvda-13g-filed-by-nvidia.xml'))!;
  assert.equal(filedByNvidia.issuerCik, 1513845, 'NVIDIA’s own 13G is about another issuer');
  assert.equal(
    rawXmlUrl('https://www.sec.gov/Archives/edgar/data/1/0001/xslSCHEDULE_13G_X02/primary_doc.xml'),
    'https://www.sec.gov/Archives/edgar/data/1/0001/primary_doc.xml',
  );
  assert.equal(percentFromText('11. Percent of class represented by amount in Row (9) 7.3 %'), 7.3);
});

test('Form 4: the lines it reports, summed and labelled a lower bound', () => {
  const f = parseForm4(fixture('nvda-form4.xml'))!;
  assert.equal(f.owner, 'Tench Coxe');
  assert.equal(f.role, 'Director');
  assert.equal(f.date, '2026-10-07');
  assert.equal(f.sharesReported, 23_671_360 + 57_378 + 4_852_480);
  assert.equal(f.lowerBound, true);
  assert.equal(ownerName('HUANG JEN HSUN'), 'Jen Hsun Huang');
});

test('NVIDIA holders, end to end on recorded filings: dated rows and a remainder that says what it is', async () => {
  resetSnapshots();
  resetPacing();
  const v = await holders(bySlug('nvidia')!, MARKET_DEPS);
  assert.ok(!('unavailable' in v));
  assert.deepEqual(
    v.holders.map((h) => [h.name, h.percent, h.asOf, Boolean(h.inGroup)]),
    [
      ['BlackRock, Inc.', 7.43, '2026-03-23', false],
      ['Vanguard Capital Management', 7.31, '2026-03-31', false],
      ['Directors and executive officers as a group', 3.94, '2026-03-23', false],
      ['Jen-Hsun Huang', 3.58, '2026-03-23', true],
    ],
  );
  assert.equal(v.remainder?.label, 'Other holders (each below 5%; not itemised in filings)');
  assert.equal(v.remainder?.percent, 81.32);
  assert.match(v.remainder!.explanation, /13F lists each fund manager’s whole portfolio/);
  assert.match(v.institutionsNote, /13G\/13D and the proxy statement only/);
  assert.ok(v.notes.some((n) => /The Vanguard Group reported 0%/.test(n)));
  assert.equal(v.insiders[0].owner, 'Tench Coxe');
  for (const h of v.holders) assert.match(h.source.url, /^https:\/\/www\.sec\.gov\/Archives\//);
});

test('no remainder where one would mislead', () => {
  const base = { company: 'X', proxy: null, schedules: [], insiders: [], fallback: [] };
  assert.match(buildHolders(base).remainderWhyNot!, /No holder above 5%/);
  const row = (name: string, share: number) => ({
    name,
    share,
    kind: 'fund' as const,
    asOf: '2026',
    source: 'https://example.com/ar.pdf',
  });
  assert.match(
    buildHolders({ ...base, fallback: [row('A', 60), row('B', 50)] }).remainderWhyNot!,
    /more than 100%/,
  );
  assert.match(
    buildHolders({ ...base, fallback: [row('A', 10)], multiClass: true }).remainderWhyNot!,
    /several share classes/,
  );
  assert.equal(buildHolders({ ...base, fallback: [row('A', 10)] }).remainder?.percent, 90);
});

test('the company page’s ownership view carries the same typed remainder', () => {
  const v = ownershipView('nvidia');
  assert.equal(v.remainder?.label, 'Other holders (each below 5%; not itemised in filings)');
  assert.equal(v.remainder?.short, 'Others, each below 5%');
  assert.equal(v.remainder?.percent, Number(v.rest!.toFixed(2)));
});
