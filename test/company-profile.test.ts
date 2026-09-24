/**
 * Company profiles join to what the company actually holds.
 *
 * Until 2026-09-24 the join read only the materials file, so every company
 * whose chokepoint is a machine, a process or a capacity — ASML, TSMC, SK
 * hynix, Hitachi Energy, 55 of 101 directory rows — rendered "No covered
 * material is mapped to this organisation yet" while the EUV scanner row said
 * "one company on earth builds them". These hold the join, not a layout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHOKEPOINTS, COVERAGE } from '../config/substrata-coverage';
import { PARTICIPANTS } from '../config/substrata-participants';
import { BOTTLENECKS, bottleneckByName } from '../lib/bottlenecks';
import { bindingSum, companyProfile } from '../lib/company-profile';
import { entitiesOfKind } from '../lib/entities/registry';
import { MARKET_PARTICIPANTS } from '../lib/participants';
import { modulesFor } from '../lib/profile/modules';

const DIRECTORY = new Map(PARTICIPANTS.map((p) => [p.name, p]));
const byName = (name: string) => MARKET_PARTICIPANTS.find((p) => p.name === name);

test('every chokepoint holder is a sourced directory row, spelled exactly', () => {
  for (const point of CHOKEPOINTS) {
    for (const holder of point.holders) {
      const row = DIRECTORY.get(holder.name);
      assert.ok(row, `${point.name}: holder "${holder.name}" is not in the directory`);
      assert.ok(
        row.source,
        `${holder.name} holds ${point.name} but its directory row cites nothing`,
      );
    }
  }
});

test('every producer or holder that is a directory company joins to its bottleneck', () => {
  const rows = [
    ...COVERAGE.flatMap((e) => e.producers.map((p) => [e.material, p.name] as const)),
    ...CHOKEPOINTS.flatMap((c) => c.holders.map((h) => [c.name, h.name] as const)),
  ];
  for (const [bottleneck, name] of rows) {
    const company = byName(name);
    assert.ok(company, `${name} makes ${bottleneck} but has no company page`);
    assert.ok(
      company.produces.some((x) => x.bottleneck === bottleneck),
      `${name}'s page does not show ${bottleneck}`,
    );
    const profile = companyProfile(company.slug);
    assert.ok(
      profile?.held.some((h) => h.bottleneck.name === bottleneck),
      `${name}'s profile does not hold ${bottleneck}`,
    );
  }
});

test('ASML holds the EUV scanner row, as its only recorded maker, sourced', () => {
  const profile = companyProfile('asml');
  assert.ok(profile);
  const euv = profile.held.find((h) => h.bottleneck.name === 'EUV lithography scanners');
  assert.ok(euv, 'ASML lost EUV lithography scanners');
  assert.equal(euv.verification, 'sourced');
  assert.equal(euv.soleRecorded, true, 'a part supplier was counted as a second EUV maker');
  assert.equal(profile.hardest?.bottleneck.binding, bottleneckByName(euv.bottleneck.name)?.binding);
  assert.ok(profile.events.length > 0, 'ASML lost its event');
  const ids = modulesFor(entitiesOfKind('company').find((e) => e.key === 'asml')!).map((m) => m.id);
  assert.ok(ids.includes('chokepoints'));
});

test('a part supplier is not a second source, and its counterparts are the makers', () => {
  const zeiss = companyProfile('carl-zeiss-smt');
  const scanners = zeiss?.held.find((h) => h.bottleneck.name === 'EUV lithography scanners');
  assert.ok(scanners, 'Zeiss should supply into the scanner row');
  assert.equal(scanners.supplier, true);
  assert.equal(scanners.soleRecorded, false);
  assert.deepEqual(
    scanners.counterparts.map((c) => c.name),
    ['ASML'],
  );
});

test('a binding score is always the stated sum of its four tests', () => {
  for (const b of BOTTLENECKS) {
    const s = b.score;
    assert.equal(b.binding, s.concentration + s.substitution + s.leadTime + s.inelasticity);
    assert.ok(bindingSum(b).endsWith(`= ${b.binding} of 12`), b.name);
  }
});

test('a company that holds nothing shows no empty chokepoint or relief section', () => {
  const nvidia = entitiesOfKind('company').find((e) => e.key === 'nvidia');
  assert.ok(nvidia);
  const rendered = modulesFor(nvidia)
    .filter((m) => m.render(nvidia) !== null)
    .map((m) => m.id);
  assert.ok(!rendered.includes('chokepoints'));
  assert.ok(!rendered.includes('relief'));
  assert.ok(rendered.includes('same-layer'), 'a company with no chokepoint still gets context');
});
