/**
 * Tables, not walls: many facility rows reach the reader as a table built in
 * code (lib/chat-tools/facility-table.ts), every cell the source's own text;
 * the table goes to the answer, never to the model (registry.ts); and the
 * relation tools hand back rows with their evidence, never a bare claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import fixture from '../scripts/ux/fixtures/kz-uranium-table.json';
import { isAnswerTable, tableText, type AnswerTable } from '../lib/chat/answer-table';
import { GRAPH_TOOLS } from '../lib/chat-tools/graph';
import { quoteExcerpt } from '../lib/chat-tools/graph-rows';
import { emptyLedger } from '../lib/chat-tools/ledger';
import { PRODUCER_TOOLS } from '../lib/chat-tools/producers';
import { runTool } from '../lib/chat-tools/registry';
import { allFacilitiesFor } from '../lib/resources/producers';

const producersIn = PRODUCER_TOOLS[0];

async function tableFor(country: string, resource: string) {
  const out = (await producersIn.run({ country, resource }, { ledger: emptyLedger() })) as {
    table?: AnswerTable;
    table_shown?: string;
  };
  return out;
}

test('the Kazakh uranium cell becomes one row per venture, every cell verbatim', async () => {
  const { table, table_shown } = await tableFor('Kazakhstan', 'uranium');
  assert.ok(table && isAnswerTable(table));
  assert.ok(
    table_shown && /do not write a table/i.test(table_shown),
    'the model is told not to redo the table',
  );
  const cells = allFacilitiesFor('kz')!.rows.filter((r) => r.resource === 'uranium');
  const ventures = table.rows.filter((r) => r.commodity === 'Uranium, U content');
  assert.equal(ventures.length, 16);
  assert.deepEqual(
    ventures.find((r) => r.operator === 'JV Inkai LLP'),
    {
      operator: 'JV Inkai LLP',
      owners: 'NAC Kazatomprom JSC, 60%, and Cameco Corp., 40%',
      commodity: 'Uranium, U content',
      location: null,
      capacity: null,
      year: '2023',
    },
  );
  for (const row of table.rows)
    for (const key of ['operator', 'owners'] as const)
      if (row[key])
        assert.ok(
          cells.some((c) => c.companies.includes(row[key]!)),
          `"${row[key]}" is copied from a USGS cell`,
        );
  // The place list and capacity USGS printed once for all sixteen are not divided among them.
  const shared = table.shared.map((s) => s.text);
  assert.ok(shared.some((t) => t.startsWith('Locations: Blocks 1, 3, and 4')));
  assert.ok(shared.includes('24000 metric tons'));
  assert.deepEqual(table.shared[0].rows, [1, 16]);
  assert.match(tableText(table), /JV Inkai LLP — NAC Kazatomprom JSC, 60%, and Cameco Corp., 40%/);
});

test('the layout check draws the table the code builds today', async () => {
  const { table } = await tableFor('Kazakhstan', 'uranium');
  assert.deepEqual(table, fixture, 'regenerate scripts/ux/fixtures/kz-uranium-table.json');
});

test('every facility answer carries its table, one row or many; never sent to the model', async () => {
  // Kazakhstan's rare earths: one plant — a table of one row, named in the summary.
  const small = (await tableFor('Kazakhstan', 'rare earths')) as {
    table?: AnswerTable;
    summary?: string[];
  };
  assert.equal(small.table?.rows.length, 1);
  assert.ok(small.summary?.some((s) => s.startsWith('Operators, as printed: ')));
  const ledger = emptyLedger();
  const { result } = await runTool(
    'producers_in',
    { country: 'Kazakhstan', resource: 'uranium' },
    { ledger },
  );
  assert.ok(!result.includes('"table"'), 'the model does not pay for the table');
  assert.ok(result.includes('table_shown'));
  assert.equal(ledger.tables.length, 1);
  assert.equal(ledger.tables[0].id, 'usgs-kz-uranium-2023');
});

test('a long cell is cut to the one venture it names, verbatim', () => {
  const cell = allFacilitiesFor('kz')!.rows.find((r) => /^Companies:/.test(r.companies))!.companies;
  const part = quoteExcerpt(cell, ['Sumitomo Corp.', 'APPAK LLP']);
  assert.equal(part.whole, false);
  assert.equal(
    part.text,
    'APPAK LLP (NAC Kazatomprom JSC, 65%; Sumitomo Corp., 25%; Kansai Electric Power Co. Inc., 10%)',
  );
  assert.ok(cell.includes(part.text));
  assert.deepEqual(quoteExcerpt('A short quote.', ['A']), { text: 'A short quote.', whole: true });
});

const [relatedTo, howConnected] = GRAPH_TOOLS;
type Row = { name: string; grade: string; counted: boolean; source: { reading: string } };

test('related_to: owners with their reading; a curated row is said, a lead is not counted', async () => {
  const asml = (await relatedTo.run(
    { entity: 'ASML', direction: 'in' },
    { ledger: emptyLedger() },
  )) as {
    owners: Row[];
  };
  assert.ok(asml.owners.length >= 2);
  for (const o of asml.owners) assert.equal(o.source.reading, 'curated-record');
  const tel = (await relatedTo.run(
    { entity: 'Tokyo Electron', direction: 'in' },
    { ledger: emptyLedger() },
  )) as { owners: Row[]; unverified_leads?: Row[] };
  assert.ok(tel.unverified_leads?.length, 'a lead is listed apart');
  for (const l of tel.unverified_leads ?? []) assert.equal(l.counted, false);
  assert.ok(!tel.owners.some((o) => o.grade.startsWith('Unverified')));
});

test('how_connected walks from a firm to a country’s facilities for a resource', async () => {
  const out = (await howConnected.run(
    { a: 'Sumitomo', b: 'Kazakhstan', resource: 'uranium' },
    { ledger: emptyLedger() },
  )) as { paths: { hops: number; chain: string; counted: boolean }[] };
  assert.equal(out.paths[0].hops, 2);
  assert.match(out.paths[0].chain, /^Sumitomo Corp\. owns 25% of APPAK LLP → APPAK LLP operates/);
  assert.equal(out.paths[0].counted, true);
  const none = (await howConnected.run(
    { a: 'Cameco', b: 'Chile', resource: 'lithium' },
    { ledger: emptyLedger() },
  )) as { paths: unknown[]; none?: string };
  assert.equal(none.paths.length, 0);
  assert.match(none.none ?? '', /gap in the graph/);
});
