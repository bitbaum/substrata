/**
 * The stub company page, compact (lib/entities/stub-evidence.ts), and the
 * rule that keeps people and groups of holders from becoming company stubs
 * (lib/graph/holder-kind.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OWNERSHIP } from '../config/substrata-ownership';
import { resolveEntity } from '../lib/entities/registry';
import { stubEvidence } from '../lib/entities/stub-evidence';
import { stubRelations } from '../lib/entities/sources/company-stubs';
import { graphStore } from '../lib/graph/index';
import { holderDoubt, holderVerdict } from '../lib/graph/holder-kind';

test('Kazatomprom: sixteen stakes in one group, resting on one yearbook cell printed once', () => {
  const view = stubEvidence('company:nac-kazatomprom-jsc');
  const stakes = view.groups.find((g) => g.label === 'Owns a stake in')!;
  assert.equal(stakes.rows.length, 16);
  assert.ok(stakes.rows.every((r) => r.amount?.endsWith('%') && r.asOf === '2023'));
  const cell = view.cells.find((c) => c.id === stakes.rows[0].cells[0])!;
  assert.equal(cell.rows, 16);
  assert.equal(
    cell.label,
    'the USGS Minerals Yearbook 2023 (Kazakhstan), Table 2. Structure of the mineral industry',
  );
  // Collapsed, never cut: the cell is the quote exactly as the relation carries it.
  const r = stubRelations('company:nac-kazatomprom-jsc').find(
    (x) => x.id === stakes.rows[0].relationId,
  )!;
  assert.equal(cell.quote, r.evidence[0].quote);
  const rows = view.groups.reduce((n, g) => n + g.rows.length, 0);
  assert.equal(rows, stubRelations('company:nac-kazatomprom-jsc').length);
  assert.equal(
    view.cells.reduce((n, c) => n + c.rows, 0),
    stubRelations('company:nac-kazatomprom-jsc').reduce((n, x) => n + x.evidence.length, 0),
    'every source of every row is one cell use',
  );
});

test('a venture reads "Owned by" and "Operates", from its own side', () => {
  const labels = stubEvidence('company:jv-inkai-llp').groups.map((g) => g.label);
  assert.deepEqual(labels.sort(), ['Operates', 'Owned by']);
});

test('a founder printed by their own name, or a group of holders, is never a company', () => {
  const refused = (name: string, kind = 'founder') =>
    holderVerdict({ name, kind: kind as never }).party === false;
  assert.ok(refused('Jensen Huang'));
  assert.ok(refused('Lee Jae-yong'));
  assert.ok(refused('Founding families'));
  assert.ok(refused('Leibinger family'));
  assert.ok(refused('ADR holders (Citibank as depositary)', 'public-float'));
  // An organisation, even with no legal form, stays a party.
  for (const [name, kind] of [
    ['Carl-Zeiss-Stiftung', 'founder'],
    ['Hancock Prospecting', 'strategic'],
    ['Samsung Life Insurance', 'strategic'],
    ['BlackRock', 'fund'],
    ['Jensen Huang Holdings', 'founder'],
  ])
    assert.ok(!refused(name, kind), name);
  assert.equal(resolveEntity('company:jensen-huang'), undefined);
  assert.equal(resolveEntity('company:lee-jae-yong'), undefined);
  assert.ok(resolveEntity('company:blackrock'));
  assert.ok(graphStore().skipped['holder is a person'] >= 1);
});

test('the ownership page keeps every holder; only the graph refuses the person', () => {
  const nvidia = OWNERSHIP.find((o) => o.company === 'nvidia')!;
  assert.ok(nvidia.holders.some((h) => h.name === 'Jensen Huang'));
  const doubts = OWNERSHIP.flatMap((o) => o.holders)
    .filter(holderDoubt)
    .map((h) => h.name);
  assert.ok(!doubts.includes('Jensen Huang'));
});
