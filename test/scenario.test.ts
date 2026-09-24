/**
 * Scenarios: propagation follows recorded rows only, and a part supplier is
 * never a second source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BOTTLENECKS } from '../lib/bottlenecks';
import { makersOf } from '../lib/bottleneck-makers';
import { exposureRows } from '../lib/exposure';
import { directHits, downstreamHits } from '../lib/scenario/propagate';
import { exposedCompanies } from '../lib/scenario/exposed';
import { recoveryFor } from '../lib/scenario/recovery';
import { PRESETS, presetScenario } from '../lib/scenario/presets';
import { parseScenario, scenarioHref } from '../lib/scenario/target';

const run = (at: string, only?: string) => {
  const s = parseScenario({ at, ...(only ? { only } : {}) });
  assert.ok(s, `${at} did not parse`);
  const hits = directHits(s);
  return { s, hits, down: downstreamHits(hits) };
};

test('regression: a part supplier is never counted as a second source', () => {
  const euv = BOTTLENECKS.find((b) => b.name === 'EUV lithography scanners')!;
  assert.deepEqual(
    makersOf(euv).map((m) => m.name),
    ['ASML'],
  );
  const { hits } = run('company:asml');
  const hit = hits.find((h) => h.bottleneck === euv.name)!;
  assert.equal(hit.status, 'no-maker-left', 'Zeiss and Trumpf remain, and neither makes scanners');
  assert.deepEqual(hit.remaining, []);
  const row = exposureRows().find((r) => r.company === 'ASML' && r.bottleneck === euv.name)!;
  assert.equal(row.otherMakers, 0);
});

test('Zeiss offline: optics lose their only maker, scanners lose a part, the fab is downstream', () => {
  const { s, hits, down } = run('company:carl-zeiss-smt');
  const by = new Map(hits.map((h) => [h.bottleneck, h]));
  assert.equal(by.get('EUV projection optics')?.status, 'no-maker-left');
  assert.equal(by.get('EUV lithography scanners')?.status, 'part-lost');
  assert.deepEqual(by.get('EUV lithography scanners')?.remaining, ['ASML']);
  const fab = down.find((d) => d.bottleneck === 'Leading-edge foundry capacity');
  assert.ok(fab, 'leading-edge foundry capacity needs EUV scanners');
  assert.ok(fab.path.every((e) => e.source.startsWith('https://')));
  const companies = exposedCompanies(hits, down, s.at.name);
  assert.ok(
    companies.some((c) => c.name === 'NVIDIA' && c.exposures.some((e) => e.kind === 'needs')),
  );
  assert.ok(companies.some((c) => c.name === 'TSMC'));
});

test('China halts gallium: Chinese refiners lost, others remain, share computed from USGS', () => {
  const { hits } = run('country:CN', 'gallium-refined');
  assert.equal(hits.length, 1);
  const [ga] = hits;
  assert.equal(ga.status, 'makers-left');
  assert.ok(ga.lost.includes('Chalco'));
  assert.ok(ga.remaining.length > 0);
  const r = recoveryFor(ga.slug, 'CN')!;
  assert.ok(r.output && r.output.share > 0 && r.output.share <= 1);
  assert.match(r.output.source, /usgs\.gov/);
});

test('a maker operating inside and outside the country is partly affected, not lost', () => {
  const { hits } = run('country:DE');
  const poly = hits.find((h) => h.bottleneck === 'Electronic-grade polysilicon')!;
  assert.ok(poly.partial.includes('Wacker Chemie'));
  assert.ok(!poly.lost.includes('Wacker Chemie'));
});

test('every preset parses, names a real record, and has a shareable URL', () => {
  for (const p of PRESETS) {
    const s = presetScenario(p);
    assert.ok(s, `${p.id}: target ${p.at} does not parse`);
    assert.ok(directHits(s).length > 0, `${p.id}: hits nothing`);
    assert.ok(p.basis.href.startsWith('https://') || p.basis.href.startsWith('/'));
    assert.equal(
      parseScenario(Object.fromEntries(new URL(`https://x${scenarioHref(s)}`).searchParams))?.at
        .name,
      s.at.name,
    );
  }
});

test('a scenario with an unknown node is not a scenario', () => {
  assert.equal(parseScenario({ at: 'company:not-a-company' }), null);
  assert.equal(parseScenario({ at: 'country:ZZ' }), null);
  assert.equal(parseScenario({}), null);
});
