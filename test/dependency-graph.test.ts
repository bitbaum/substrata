/**
 * Dependency rows are graph edges: every row appears once, reads from both
 * ends, keeps its sentence, and the assistant can walk it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEPENDENCIES } from '../config/substrata-dependencies';
import { allRelations } from '../lib/relations/registry';
import { neighbors } from '../lib/graph';
import { resolveIn } from '../lib/entities/registry';
import { dependencyGroups } from '../lib/profile/modules/dependencies';
import { connectionsFor } from '../lib/profile/modules/shared';
import { runTool } from '../lib/chat-tools/registry';
import { emptyLedger } from '../lib/chat-tools/ledger';

test('every dependency row becomes exactly one edge carrying its source and sentence', () => {
  const edges = allRelations().filter((r) => r.kind === 'depends-on' || r.kind === 'sells-into');
  assert.equal(edges.length, DEPENDENCIES.length, 'a row failed to resolve to two entities');
  for (const edge of edges) {
    assert.equal(edge.sources.length, 1, `${edge.from} → ${edge.to} has no source`);
    assert.ok(edge.quote && edge.quote.length > 10, `${edge.from} → ${edge.to} lost its quote`);
    assert.match(edge.evidence, /^(primary|secondary) source$/);
  }
});

test('NVIDIA depends on advanced packaging, and the packaging page names NVIDIA back', () => {
  const out = neighbors('company', 'nvidia').find(
    (e) => e.rel === 'depends on' && e.to.id === 'advanced-packaging-capacity',
  );
  assert.ok(out, 'NVIDIA → advanced packaging edge missing from /api/graph');
  assert.match(out.quote ?? '', /CoWoS/);
  const back = neighbors('bottleneck', 'advanced-packaging-capacity').find(
    (e) => e.rel === 'depended on by' && e.to.id === 'nvidia',
  );
  assert.ok(back, 'the inverse reading is missing');
  assert.equal(back.quote, out.quote, 'one fact told two ways');
});

test('profiles show dependencies in their own section, not twice', () => {
  const nvidia = resolveIn('company', 'nvidia');
  assert.ok(nvidia);
  const groups = dependencyGroups(nvidia);
  assert.deepEqual(
    groups.map((g) => g.label),
    ['depends on'],
  );
  assert.ok(
    !connectionsFor(nvidia).some((e) => e.rel === 'depends on'),
    '"What this connects to" repeats the dependency section',
  );
  const foundry = resolveIn('bottleneck', 'leading-edge-foundry-capacity');
  assert.ok(foundry);
  const labels = dependencyGroups(foundry).map((g) => g.label);
  for (const want of ['depends on', 'depended on by', 'a market for'])
    assert.ok(labels.includes(want), `foundry page lacks "${want}"`);
});

test('Ask can walk a company upstream, each hop quoted', async () => {
  const env = { ledger: emptyLedger() };
  const { result } = await runTool('trace_dependencies', { name: 'NVIDIA' }, env);
  const data = JSON.parse(result);
  assert.equal(data.company, 'NVIDIA');
  assert.ok(data.direct.length >= 3);
  const wafers = data.further_upstream.find(
    (r: { reaches: string }) => r.reaches === '300 mm prime silicon wafers',
  );
  assert.ok(wafers, 'NVIDIA should reach wafers through HBM or foundry');
  assert.ok(wafers.source && wafers.quote);
  assert.ok(!/truncated/.test(result), 'the walk overflowed the tool budget');
  assert.ok(env.ledger.records.size > 0, 'the walk should record what it read');
});

test('Ask can walk a bottleneck downstream to the companies resting on it', async () => {
  const { result } = await runTool(
    'trace_dependencies',
    { name: 'EUV lithography scanners', direction: 'downstream' },
    { ledger: emptyLedger() },
  );
  const data = JSON.parse(result);
  const foundry = data.reached.find(
    (r: { reaches: string }) => r.reaches === 'Leading-edge foundry capacity',
  );
  assert.ok(foundry, 'EUV → foundry missing');
  assert.ok(foundry.companies_resting_on_it.some((c: { company: string }) => c.company === 'AMD'));
});

test('an unknown name is a usable miss', async () => {
  const { result } = await runTool(
    'trace_dependencies',
    { name: 'Totally Invented Widgets' },
    { ledger: emptyLedger() },
  );
  assert.match(JSON.parse(result).error, /No company or bottleneck/);
});

test('the busiest bottleneck record still fits the tool budget with its dependencies', async () => {
  const { result } = await runTool(
    'get_bottleneck',
    { name: 'Leading-edge foundry capacity' },
    { ledger: emptyLedger() },
  );
  assert.ok(!/truncated/.test(result), 'dependency rows pushed producers out of the answer');
  assert.ok(JSON.parse(result).dependencies.companies_selling_into_it.includes('KLA'));
});
