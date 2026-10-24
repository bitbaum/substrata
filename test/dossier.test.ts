/**
 * The dossier standard: completeness is computed from rows, by one written
 * rule per box, and the work queue that falls out of it is deterministic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FACETS } from '../lib/entry/candidate';
import { FACET_SPECS } from '../lib/entry/schemas';
import type { Facet } from '../lib/entry/candidate';
import { computeBox, computeDossier } from '../lib/dossier/compute';
import {
  DOSSIER_KINDS,
  PRIORITY_COUNTRIES,
  boxStatus,
  boxesFor,
  countedRows,
  type BoxDefinition,
  type RowCounts,
} from '../lib/dossier/definitions';
import { memoryDemand, recordDemand, useDemandLedger, demandLedger } from '../lib/dossier/demand';
import { NO_RELATIONS, ZERO_GRADES, type RelationCounter } from '../lib/dossier/relations';
import { resolveSubject } from '../lib/dossier/subjects';
import { emitTasks } from '../lib/dossier/tasks';
import { operatorOf } from '../lib/dossier/counters/shared';
import { gapsJson, parseGapsArgs } from '../scripts/research/gaps';

const ALL_BOXES: BoxDefinition[] = DOSSIER_KINDS.flatMap((k) => [...boxesFor(k)]);

function counts(stated: number, extra: Partial<RowCounts> = {}): RowCounts {
  return { stated, corroborated: 0, derived: 0, lead: 0, basis: '', ...extra };
}

/** Counts that make this box full, at exactly its thresholds. */
function atFull(def: BoxDefinition): RowCounts {
  return counts(def.thresholds.full, def.thresholds.core ? { core: def.thresholds.core } : {});
}

test('every box: full at its threshold, thin below it, empty at zero', () => {
  for (const def of ALL_BOXES) {
    const at = `${def.kind}.${def.id}`;
    assert.equal(boxStatus(atFull(def), def.thresholds), 'full', `${at} full`);
    assert.equal(boxStatus(counts(0), def.thresholds), 'empty', `${at} empty`);
    const thin =
      def.thresholds.full > def.thresholds.thin
        ? counts(def.thresholds.thin)
        : counts(def.thresholds.full, { core: 0, expected: def.thresholds.full + 1 });
    assert.equal(boxStatus(thin, def.thresholds), 'thin', `${at} thin`);
  }
});

test('mutation proof: one row fewer, one core row fewer, or one expected row more is never full', () => {
  for (const def of ALL_BOXES) {
    const at = `${def.kind}.${def.id}`;
    const full = atFull(def);
    if (def.thresholds.full > 1)
      assert.notEqual(boxStatus({ ...full, stated: full.stated - 1 }, def.thresholds), 'full', at);
    if (def.thresholds.core !== undefined)
      assert.notEqual(
        boxStatus({ ...full, core: def.thresholds.core - 1 }, def.thresholds),
        'full',
        at,
      );
    assert.notEqual(
      boxStatus({ ...full, expected: full.stated + 1 }, def.thresholds),
      'full',
      `${at}: expected rows`,
    );
  }
});

test('leads and derived rows never move a box; corroborated rows do', () => {
  for (const def of ALL_BOXES) {
    const noisy = counts(0, { lead: 999, derived: 999, core: 99 });
    assert.equal(countedRows(noisy), 0);
    assert.equal(boxStatus(noisy, def.thresholds), 'empty', `${def.kind}.${def.id}`);
    const corroborated = { ...atFull(def), stated: 0, corroborated: def.thresholds.full };
    assert.equal(boxStatus(corroborated, def.thresholds), 'full');
  }
});

test('the standard: every box has sources, a place to write and sane thresholds', () => {
  const kinds = { country: 7, company: 8, resource: 6, lab: 4, science: 4 };
  for (const kind of DOSSIER_KINDS) assert.equal(boxesFor(kind).length, kinds[kind], kind);
  for (const def of ALL_BOXES) {
    const at = `${def.kind}.${def.id}`;
    assert.ok(def.allowedSources.length >= 2, `${at}: fewer than two source families`);
    assert.ok(def.writeTo.file && def.writeTo.command, `${at}: nowhere to write`);
    assert.ok(def.thresholds.full >= def.thresholds.thin && def.thresholds.thin >= 1, at);
    if (def.thresholds.core !== undefined) assert.ok(def.coreNeed, `${at}: core without words`);
    if (def.writeTo.facet !== null && def.writeTo.facet !== 'relations')
      assert.ok((FACETS as readonly string[]).includes(def.writeTo.facet), `${at}: unknown facet`);
  }
  for (const kind of DOSSIER_KINDS) {
    const ids = boxesFor(kind).map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length, `${kind}: duplicate box`);
  }
});

test('every worked example in a candidate facet passes that facet’s schema', () => {
  for (const def of ALL_BOXES) {
    const facet = def.writeTo.facet;
    if (facet === null || facet === 'relations') continue;
    const parsed = FACET_SPECS[facet as Facet].schema.safeParse(def.example);
    assert.ok(parsed.success, `${def.kind}.${def.id}: ${JSON.stringify(parsed.error?.issues)}`);
  }
});

const STATUS = (id: string) =>
  Object.fromEntries(computeDossier(id)!.boxes.map((b) => [b.box, b.status]));

test('computed against the real corpus: Kazakhstan, China, United States, Niger', () => {
  assert.deepEqual(STATUS('country:kz'), {
    endowment_output: 'full',
    facilities: 'full',
    companies: 'full',
    law_licensing: 'thin',
    trade: 'empty',
    events: 'empty',
    people_labs: 'empty',
  });
  assert.deepEqual(STATUS('country:cn'), {
    endowment_output: 'full',
    facilities: 'full',
    companies: 'full',
    law_licensing: 'thin',
    trade: 'empty',
    events: 'thin',
    people_labs: 'empty',
  });
  assert.deepEqual(STATUS('country:us'), {
    endowment_output: 'full',
    facilities: 'thin',
    companies: 'full',
    law_licensing: 'full',
    trade: 'empty',
    events: 'full',
    people_labs: 'empty',
  });
  assert.deepEqual(STATUS('country:ne'), {
    endowment_output: 'full',
    facilities: 'thin',
    companies: 'thin',
    law_licensing: 'empty',
    trade: 'empty',
    events: 'empty',
    people_labs: 'empty',
  });
});

test('real fixtures for the other kinds', () => {
  // Kazakhstan's 35 USGS rows fill facilities; Niger's three leave it thin.
  assert.equal(computeDossier('country:kz')!.boxes[1].counted, 35);
  assert.equal(computeDossier('country:ne')!.boxes[1].counted, 3);
  // Mutation: the same 35 rows read thin under a threshold of 36 — the constant, not a flag, decides.
  const kzFacilities = computeDossier('country:kz')!.boxes[1];
  const facilitiesDef = boxesFor('country')[1];
  assert.equal(boxStatus(kzFacilities.counts, { ...facilitiesDef.thresholds, full: 36 }), 'thin');
  // A listed firm with three notifiable holders on record has known control; two is thin.
  assert.equal(STATUS('company:tsmc').owners, 'full');
  assert.equal(STATUS('company:asml').owners, 'thin');
  assert.equal(STATUS('company:asml').filings, 'full');
  assert.equal(STATUS('resource:uranium').producers, 'full');
  assert.equal(STATUS('resource:gallium').reserves, 'empty');
  assert.equal(STATUS('resource:lithium').restrictions, 'full');
  assert.equal(computeDossier('country:xx'), null);
  assert.equal(computeDossier('resource:unobtainium'), null);
});

test('every priority country has a page and a dossier', () => {
  for (const iso2 of PRIORITY_COUNTRIES) assert.ok(resolveSubject(`country:${iso2}`), iso2);
});

test('the USGS operator is the text before its owner bracket', () => {
  assert.equal(
    operatorOf('Aluminium of Kazakhstan JSC [Eurasian Resources Group (ERG), 100%]'),
    'Aluminium of Kazakhstan JSC',
  );
  assert.equal(operatorOf('Kazzinc Ltd. [Glencore plc, 69.7%, and NMC Tau-Ken'), 'Kazzinc Ltd');
  assert.equal(operatorOf('NA'), null);
});

test('the relations seam: stated edges fill a relation box, leads do not', () => {
  const kz = resolveSubject('country:kz')!;
  const trade = boxesFor('country').find((b) => b.id === 'trade')!;
  const stated: RelationCounter = {
    count: (subject, q) =>
      subject === 'country:kz' && q.types.includes('ships_to')
        ? { ...ZERO_GRADES, stated: 3 }
        : { ...ZERO_GRADES },
  };
  const leads: RelationCounter = { count: () => ({ ...ZERO_GRADES, lead: 50, derived: 50 }) };
  assert.equal(computeBox(trade, kz, { relations: NO_RELATIONS }).status, 'empty');
  assert.equal(computeBox(trade, kz, { relations: stated }).status, 'full');
  assert.equal(computeBox(trade, kz, { relations: leads }).status, 'empty');
});

test('tasks: one per empty or thin box, each with a sentence, sources and an instruction', () => {
  const tasks = emitTasks({ entity: 'country:kz' });
  assert.deepEqual(tasks.map((t) => t.box).sort(), [
    'events',
    'law_licensing',
    'people_labs',
    'trade',
  ]);
  for (const t of tasks) {
    assert.ok(t.missing.length > 20 && t.allowedSources.length >= 2 && t.writeTo, t.id);
    assert.equal(t.demand, 0);
    assert.ok(t.instruction.includes(t.href) && t.instruction.includes(t.allowedSources[0]));
  }
  const events = tasks.find((t) => t.box === 'events')!;
  assert.equal(events.blockedBy, null);
  assert.ok(events.instruction.includes('scripts/research/add.ts events --schema'));
  // Every map country is a jurisdiction, so Kazakhstan's law can be recorded:
  // the task says what to record and where, a law firm only as secondary.
  const law = tasks.find((t) => t.box === 'law_licensing')!;
  assert.equal(law.blockedBy, null);
  assert.match(law.instruction, /Record one instrument per row/);
  assert.match(law.instruction, /subsoil or mining law/);
  assert.match(law.instruction, /official gazette/);
  assert.match(law.instruction, /OECD Inventory of Export Restrictions/);
  assert.match(
    law.instruction,
    /law firm's summary of the primary law, only as a secondary source/,
  );
  assert.ok(law.instruction.includes('add.ts instruments --schema'));
});

test('the queue is ordered by demand, then the owner’s countries, unblocked first', () => {
  const tasks = emitTasks({ kind: 'country' });
  const firstCountries = [...new Set(tasks.map((t) => t.entity))].slice(0, 3);
  assert.deepEqual(firstCountries, ['country:ne', 'country:kz', 'country:uz']);
  const ne = tasks.filter((t) => t.entity === 'country:ne');
  const firstBlocked = ne.findIndex((t) => t.blockedBy !== null);
  assert.ok(
    firstBlocked === -1 || ne.slice(firstBlocked).every((t) => t.blockedBy !== null),
    'blocked tasks trail',
  );

  const ledger = memoryDemand();
  ledger.record('country:is', 'events', 'What happened in Iceland’s aluminium smelters?');
  ledger.record('country:is', 'events', 'Any outages in Iceland?');
  const demanded = emitTasks({ kind: 'country', demand: ledger });
  assert.equal(demanded[0].id, 'country:is#events');
  assert.equal(demanded[0].demand, 2);
});

test('recordDemand files into the process ledger, and the ledger can be swapped', () => {
  const previous = useDemandLedger(memoryDemand());
  try {
    recordDemand('resource:uranium', 'producers', 'Who mines uranium in Namibia?');
    recordDemand('resource:uranium', 'producers', '   ');
    assert.equal(demandLedger().count('resource:uranium', 'producers'), 1);
  } finally {
    useDemandLedger(previous);
  }
});

test('the gaps script is deterministic and its filters work', () => {
  const a = gapsJson(parseGapsArgs(['--kind', 'country', '--limit', '40']));
  const b = gapsJson(parseGapsArgs(['--kind', 'country', '--limit', '40']));
  assert.equal(a, b);
  const parsed = JSON.parse(a) as { entity: string; box: string }[];
  assert.equal(parsed.length, 40);
  const one = JSON.parse(
    gapsJson(parseGapsArgs(['--entity', 'resource:uranium', '--box', 'science'])),
  );
  assert.deepEqual(
    one.map((t: { id: string }) => t.id),
    ['resource:uranium#science'],
  );
  assert.throws(() => parseGapsArgs(['--kind', 'planet']), /--kind/);
  assert.throws(() => parseGapsArgs(['--limit']), /needs a value/);
  assert.throws(() => parseGapsArgs(['--colour', 'red']), /unknown flag/);
});
