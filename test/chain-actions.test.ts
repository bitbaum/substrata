/**
 * What a reader can do with a chain, by who they are — and every row points
 * at a real page filtered to this bottleneck, with a line built from the data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AUDIENCES } from '../config/audiences';
import { BOTTLENECKS, bottleneckBySlug } from '../lib/bottlenecks';
import { chainActions } from '../app/atlas/chain-actions';

const EUV = bottleneckBySlug('euv-lithography-scanners')!;

test('EUV: the equities row names the listed maker and its ticker, and opens the stop scenario', () => {
  const eq = chainActions(EUV).find((a) => a.audience === 'equities')!;
  assert.match(eq.line, /ASML \(ASML [A-Z]+\)/);
  assert.equal(eq.href, '/scenarios?at=bottleneck:euv-lithography-scanners');
  assert.equal(eq.who, 'Equity investors');
  const rows = chainActions(EUV);
  assert.match(rows.find((a) => a.audience === 'jobs')!.line, /EUV lithography scanners/);
  const rules = rows.find((a) => a.audience === 'commodities')?.line ?? '';
  assert.doesNotMatch(rules, /\b1 rule or export control on file touch\b/, 'one rule touches');
});

test('a bottleneck made from a mapped resource sends commodity traders to that resource on the globe', () => {
  const tin = bottleneckBySlug('high-purity-tin-euv-droplet-grade')!;
  const row = chainActions(tin).find((a) => a.audience === 'commodities')!;
  assert.equal(row.href, '/atlas?view=world&resource=tin');
  assert.match(row.line, /made from tin/);
});

test('every row is one of the site audiences, links inside the site, and says something', () => {
  const ids = new Set(AUDIENCES.map((a) => a.id));
  for (const b of BOTTLENECKS) {
    const rows = chainActions(b);
    assert.ok(rows.length >= 4, `${b.slug} offers ${rows.length} rows`);
    for (const r of rows) {
      assert.ok(ids.has(r.audience), `${b.slug}: unknown audience ${r.audience}`);
      assert.ok(r.href.startsWith('/'), `${b.slug}: ${r.audience} leaves the site: ${r.href}`);
      assert.ok(r.line.length > 20, `${b.slug}: ${r.audience} line is empty`);
      assert.doesNotMatch(r.line, /undefined|NaN/, `${b.slug}: ${r.audience}`);
    }
    // Job seekers land on roles filed under this bottleneck, by slug.
    const jobs = rows.find((r) => r.audience === 'jobs')!;
    assert.equal(jobs.href, `/careers?bottleneck=${b.slug}`);
  }
});
