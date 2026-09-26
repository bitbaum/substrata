/**
 * Portfolio X-ray: every ticker form a desk pastes, resolution against the
 * listings file only, and routes that follow recorded rows only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEPENDENCIES } from '../config/substrata-dependencies';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { MARKET_PARTICIPANTS } from '../lib/participants';
import { parseHoldings, parseTicker, parseWeight } from '../lib/xray/parse';
import { resolveHolding } from '../lib/xray/resolve';
import { xrayCompanies } from '../lib/xray/holding';
import { xrayPortfolio } from '../lib/xray/portfolio';
import { xrayCsv, XRAY_CSV_HEADER } from '../lib/xray/csv';

test('ticker forms: terminal, venue, vendor suffix and prefix all parse', () => {
  assert.deepEqual(parseTicker('ASML'), { ticker: 'ASML', exchange: null });
  assert.deepEqual(parseTicker('ASML NA'), { ticker: 'ASML', exchange: 'NA' });
  assert.deepEqual(parseTicker('asml na equity'), { ticker: 'ASML', exchange: 'NA' });
  assert.deepEqual(parseTicker('8035 JP'), { ticker: '8035', exchange: 'JP' });
  assert.deepEqual(parseTicker('8035 JT'), { ticker: '8035', exchange: 'JP' });
  assert.deepEqual(parseTicker('NVDA UW'), { ticker: 'NVDA', exchange: 'US' });
  assert.deepEqual(parseTicker('NASDAQ:NVDA'), { ticker: 'NVDA', exchange: 'US' });
  assert.deepEqual(parseTicker('8035.T'), { ticker: '8035', exchange: 'JP' });
  assert.deepEqual(parseTicker('ASML.AS'), { ticker: 'ASML', exchange: 'NA' });
  assert.equal(parseTicker('Carl Zeiss SMT'), null, 'a name is not a ticker');
  assert.equal(parseTicker('NVDA XX'), null, 'an unknown exchange code is not guessed');
});

test('weights: percent, fraction, count with separators', () => {
  assert.equal(parseWeight('12.5%'), 12.5);
  assert.equal(parseWeight('0.125'), 0.125);
  assert.equal(parseWeight('1,200'), 1200);
  assert.equal(parseWeight('-3'), null);
  assert.equal(parseWeight('abc'), null);
});

test('lines, CSV with a header, and rejects', () => {
  const lines = parseHoldings('NVDA US 20%\nASML NA, 10\n8035 JP\t5\n# comment\nhello world');
  assert.deepEqual(
    lines.holdings.map((h) => [h.ticker, h.exchange, h.weight]),
    [
      ['NVDA', 'US', 20],
      ['ASML', 'NA', 10],
      ['8035', 'JP', 5],
    ],
  );
  assert.deepEqual(lines.rejected, ['hello world']);
  const csv = parseHoldings('Name,Ticker,Weight\nNvidia,NVDA US,0.6\nMicron,MU,0.4');
  assert.deepEqual(
    csv.holdings.map((h) => [h.ticker, h.exchange, h.weight]),
    [
      ['NVDA', 'US', 0.6],
      ['MU', null, 0.4],
    ],
  );
});

test('resolution reads only the listings file; a parent resolves to its subsidiaries', () => {
  const asml = resolveHolding({ ticker: 'ASML', exchange: 'NA' });
  assert.equal(asml.status, 'resolved');
  assert.deepEqual(asml.status === 'resolved' && asml.slugs, ['asml']);
  const tel = resolveHolding({ ticker: '8035', exchange: 'JP' });
  assert.deepEqual(tel.status === 'resolved' && tel.slugs, ['tokyo-electron']);
  const samsung = resolveHolding({ ticker: '005930', exchange: 'KS' });
  assert.deepEqual(samsung.status === 'resolved' && samsung.slugs, [
    'samsung-foundry',
    'samsung-memory',
  ]);
  const tsm = resolveHolding({ ticker: 'TSM', exchange: null });
  assert.deepEqual(tsm.status === 'resolved' && tsm.slugs, ['tsmc', 'tsmc-advanced-packaging']);
  assert.equal(resolveHolding({ ticker: 'ZZZZ', exchange: null }).status, 'unknown');
  assert.equal(resolveHolding({ ticker: 'TRUMPF', exchange: null }).status, 'private');
});

test('every dependency row names real nodes and carries a source and its sentence', () => {
  const bottlenecks = new Set(BOTTLENECKS.map((b) => b.name));
  const companies = new Set(MARKET_PARTICIPANTS.map((p) => p.name));
  for (const d of DEPENDENCIES) {
    assert.ok(bottlenecks.has(d.on), `${d.from} → ${d.on}: no such bottleneck`);
    assert.ok(
      d.fromKind === 'bottleneck' ? bottlenecks.has(d.from) : companies.has(d.from),
      `${d.from}: no such ${d.fromKind}`,
    );
    assert.match(d.source, /^https:\/\//);
    assert.ok(d.quote.length > 20, `${d.from} → ${d.on}: no quoted sentence`);
    assert.notEqual(d.from, d.on);
  }
});

test('NVIDIA rests on foundry, HBM and packaging by filing, and on EUV upstream', () => {
  const x = xrayCompanies(['nvidia']);
  assert.equal(x.held.length, 0, 'NVIDIA holds no bottleneck in the corpus');
  const by = new Map(x.depends.map((d) => [d.bottleneck, d.relation]));
  assert.equal(by.get('Leading-edge foundry capacity'), 'needs');
  assert.equal(by.get('High-bandwidth memory stacking yield'), 'needs');
  assert.equal(by.get('Advanced packaging capacity'), 'needs');
  assert.equal(by.get('EUV lithography scanners'), 'upstream');
  assert.equal(by.get('EUV projection optics'), 'upstream');
  const optics = x.depends.find((d) => d.bottleneck === 'EUV projection optics')!;
  assert.ok(
    optics.path.every((e) => e.source.startsWith('https://')),
    'every step is sourced',
  );
  assert.ok(x.risks.some((r) => r.kind === 'private-maker' && r.company === 'Carl Zeiss SMT'));
});

test('a part supplier does not inherit the upstream of the thing it supplies into', () => {
  const zeiss = xrayCompanies(['carl-zeiss-smt']);
  assert.ok(zeiss.held.some((h) => h.bottleneck === 'EUV lithography scanners' && h.supplier));
  assert.ok(!zeiss.depends.some((d) => d.bottleneck === 'High-purity tin, EUV droplet grade'));
});

test('the portfolio: weights normalise over resolved lines; unresolved lines are listed', () => {
  const x = xrayPortfolio('NVDA 50\nASML NA 50\nFOO 10\n9999 TT');
  assert.equal(x.holdings.length, 2);
  assert.deepEqual(
    x.holdings.map((h) => h.weight),
    [0.5, 0.5],
  );
  assert.deepEqual(
    x.unresolved.map((u) => u.input),
    ['FOO 10', '9999 TT'],
  );
  const euv = x.rails.find((r) => r.bottleneck === 'EUV lithography scanners')!;
  assert.equal(euv.weight, 1, 'both holdings rest on EUV');
  const nl = x.countries.find((c) => c.country === 'NL')!;
  assert.deepEqual(nl.allRails, ['EUV lithography scanners']);
  const csv = xrayCsv(x);
  assert.ok(csv.startsWith(XRAY_CSV_HEADER.join(',')));
  assert.match(csv, /FOO 10,.*unresolved/);
});

test('the headline names the sole-maker risk carrying the most weight, and only sole makers', async () => {
  const { topSingleSourceRisk, topCountry } = await import('../lib/xray/headline');
  const { XRAY_SAMPLE } = await import('../lib/xray/examples');
  const x = xrayPortfolio(XRAY_SAMPLE);
  const top = topSingleSourceRisk(x);
  const weightOf = (name: string) => x.rails.find((r) => r.bottleneck === name)?.weight ?? 0;
  const sole = x.risks.filter((r) => r.kind === 'sole-maker' && r.company);
  if (sole.length === 0) {
    assert.equal(top, null);
  } else {
    assert.ok(top, 'a portfolio with a sole maker under it gets a headline');
    assert.ok(
      sole.every((r) => weightOf(r.bottleneck) <= top.weight),
      'no heavier sole maker',
    );
    assert.equal(top.weight, weightOf(top.bottleneck), 'the weight is the rail weight, not new');
  }
  // A "no recorded maker" gap is never presented as a single source.
  const gapOnly = {
    rails: x.rails,
    risks: x.risks.filter((r) => r.kind !== 'sole-maker'),
  };
  assert.equal(topSingleSourceRisk(gapOnly), null);
  const c = topCountry(x);
  if (c) assert.equal(c.weight, Math.max(...x.countries.map((k) => k.allWeight)));
});
