/**
 * The relation graph (`lib/graph`): the rules a relation must meet, the USGS
 * operator parser read against real cells from the yearbook tables, the store's
 * merge and read API, the relation candidate path, and the committed generated
 * file against a fresh run of its script.
 *
 * Design: docs/architecture/2026-10-24-research-systems.md §2–3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

import producers from '../research/usgs-producers.json';
import {
  allRelations,
  neighbours,
  pathsBetween,
  relationEvidence,
  relationsFrom,
  relationsTo,
  type Relation,
} from '../lib/graph/index';
import { buildStore } from '../lib/graph/store';
import { corpusRelations } from '../lib/graph/from-corpus';
import {
  buildUsgsRelations,
  readCell,
  Unparsed,
  usgsFacilityId,
  type UsgsProducersFile,
} from '../lib/graph/usgs-operators';
import {
  countedShare,
  relationId,
  relationProblems,
  relationSetProblems,
} from '../lib/graph/validate';
import { FACET_SPECS } from '../lib/entry/schemas';
import { OUTPUT, usgsRelationsText } from '../scripts/research/build-usgs-relations';
import { EXIT, run } from '../scripts/research/add';

const USGS = producers as unknown as UsgsProducersFile;
const today = new Date().toISOString().slice(0, 10);

// =====================================================================
// THE VALIDATOR
// =====================================================================

function stated(overrides: Partial<Relation> = {}): Relation {
  const r: Relation = {
    id: '',
    from: 'company:nac-kazatomprom-jsc',
    to: 'company:jv-inkai-llp',
    type: 'owns',
    grade: 'stated',
    share: { value: 60, unit: 'percent' },
    asOf: '2023',
    evidence: [
      {
        source: 'https://pubs.usgs.gov/myb/vol3/2023/myb3-2023-kazakhstan.xlsx',
        quote: 'JV Inkai LLP (NAC Kazatomprom JSC, 60%, and Cameco Corp., 40%)',
        readOn: '2026-09-26',
      },
    ],
    ...overrides,
  };
  return { ...r, id: overrides.id ?? relationId(r) };
}

test('a well-formed stated relation has no problems', () => {
  assert.deepEqual(relationProblems(stated()), []);
});

/**
 * Each rule broken on purpose. If a rule in lib/graph/validate.ts is deleted,
 * its row here fails — that is the mutation proof.
 */
const BROKEN: [string, Partial<Relation>, RegExp][] = [
  ['no source at all', { evidence: [] }, /needs a source and a quote/],
  [
    'an empty quote',
    { evidence: [{ source: 'https://x.example/a', quote: '  ', readOn: '2026-01-01' }] },
    /too short/,
  ],
  [
    'a source that is not a web address',
    { evidence: [{ source: 'annual report', quote: 'a long enough quote', readOn: '2026-01-01' }] },
    /not a web address/,
  ],
  ['no date', { asOf: '' }, /asOf/],
  ['a date in the future', { asOf: '2999' }, /in the future/],
  ['corroborated on one source', { grade: 'corroborated' }, /two independent sources/],
  ['derived without its chain', { grade: 'derived' }, /derivedFrom/],
  ['derived without its rule', { grade: 'derived', derivedFrom: ['x'] }, /its rule/],
  ['a chain on a stated relation', { derivedFrom: ['x'], rule: 'r' }, /only a derived/],
  ['a share on operates', { type: 'operates' }, /cannot carry a share/],
  ['a share over 100', { share: { value: 101, unit: 'percent' } }, /\(0, 100\]/],
  [
    'a volume on owns',
    { volume: { value: 1, unit: 't', period: '2023' } },
    /cannot carry a volume/,
  ],
  ['an id that is not the rule', { id: 'x' }, /id must be/],
  [
    'an endpoint that is not an entity id',
    { to: 'JV Inkai' as Relation['to'] },
    /not an entity id/,
  ],
  ['a type outside the closed set', { type: 'controls' as Relation['type'] }, /RELATION_TYPES/],
];

for (const [name, overrides, problem] of BROKEN) {
  test(`the validator refuses ${name}`, () => {
    const problems = relationProblems(stated(overrides));
    assert.ok(
      problems.some((p) => problem.test(p)),
      `expected ${problem}, got ${JSON.stringify(problems)}`,
    );
  });
}

test('a derived relation may not rest on a lead, nor on a relation that does not exist', () => {
  const lead = stated({ grade: 'lead', to: 'company:jv-katco-llp' });
  const derived = stated({
    grade: 'derived',
    type: 'owns',
    to: 'company:x-llp',
    evidence: [],
    derivedFrom: [lead.id, 'company:a|owns|company:b|2023'],
    rule: 'transitive-ownership',
  });
  const problems = relationSetProblems([lead, derived]);
  assert.ok(problems.some((p) => /derived from a lead/.test(p)));
  assert.ok(problems.some((p) => /is not a relation/.test(p)));
  assert.ok(relationSetProblems([stated(), stated()]).some((p) => /listed twice/.test(p)));
});

test('a lead is never counted, whatever share it carries', () => {
  assert.equal(countedShare(stated()), 60);
  assert.equal(countedShare(stated({ grade: 'lead' })), null);
});

// =====================================================================
// THE USGS PARSER, ON REAL CELLS
// =====================================================================

/** A one-chapter file holding real cells from research/usgs-producers.json. */
function chapter(iso2: string, cells: string[]): UsgsProducersFile {
  const real = USGS.countries.find((c) => c.iso2 === iso2)!;
  return {
    source: USGS.source,
    retrieved: USGS.retrieved,
    countries: [
      {
        ...real,
        facilities: cells.map((companies, i) => ({
          resource: 'x',
          group: 'X',
          commodity: 'X',
          companies,
          location: `Test site ${i}`,
          capacity: '',
          unit: 't',
        })),
      },
    ],
  };
}

function edges(file: UsgsProducersFile): string[] {
  const built = buildUsgsRelations(file);
  const name = (id: string) => built.nodes[id]?.name ?? id;
  return built.relations.map(
    (r) => `${name(r.from)} ${r.type} ${name(r.to)}${r.share ? ` ${r.share.value}%` : ''}`,
  );
}

/** Every fixture cell must actually be printed in the yearbook file. */
function assertReal(iso2: string, cell: string) {
  const c = USGS.countries.find((x) => x.iso2 === iso2)!;
  assert.ok(
    c.facilities.some((f) => f.companies === cell),
    `fixture is not a real ${iso2} cell: ${cell}`,
  );
}

test('Kazakhstan: operator, owner with share, and the owner’s own owners', () => {
  const cell =
    'Aluminium of Kazakhstan JSC [Eurasian Resources Group (ERG), 100% (private, 60%, and Government, 40%)]';
  assertReal('kz', cell);
  assert.deepEqual(edges(chapter('kz', [cell])).sort(), [
    'Aluminium of Kazakhstan JSC operates Test site 0',
    'Eurasian Resources Group owns Aluminium of Kazakhstan JSC 100%',
    'country:kz owns Eurasian Resources Group 40%',
  ]);
});

test('Kazakhstan: the uranium joint ventures, each with its owners; a holder without a percentage gets no edge', () => {
  const cell = USGS.countries
    .find((c) => c.iso2 === 'kz')!
    .facilities.find((f) => f.companies.startsWith('Companies:'))!.companies;
  const got = edges(chapter('kz', [cell]));
  for (const want of [
    'JV Inkai LLP operates Test site 0',
    'NAC Kazatomprom JSC owns JV Inkai LLP 60%',
    'Cameco Corp. owns JV Inkai LLP 40%',
    'JSC ORANO Mining owns JV Katco LLP 51%',
    'NAC Kazatomprom JSC owns Karatau LLP 50%',
  ])
    assert.ok(got.includes(want), `missing: ${want}`);
  // "Uranium One Netherlands B.V. PLLC" and "JV Zarechoe JSC, 49.98" print no percent sign.
  assert.ok(!got.some((e) => /Uranium One Netherlands|JV Zarechoe JSC owns/.test(e)));
  assert.ok(!got.some((e) => /Japanese consortium/.test(e)), 'a category is not one party');
});

test('China: a parent printed with a share owns; one printed without a share does not', () => {
  const withShare = 'Tibet Julong Copper Co. Ltd. (Zijin Mining Group Co. Ltd., 50.1%)';
  const without = 'Xinjiang Ashele Copper Co. Ltd. (Zijin Mining Group Co. Ltd.)';
  assertReal('cn', withShare);
  assertReal('cn', without);
  assert.deepEqual(edges(chapter('cn', [withShare, without])).sort(), [
    'Tibet Julong Copper Co. Ltd. operates Test site 0',
    'Xinjiang Ashele Copper Co. Ltd. operates Test site 1',
    'Zijin Mining Group Co. Ltd. owns Tibet Julong Copper Co. Ltd. 50.1%',
  ]);
});

test('Chile: a list of holders owns the facility; a Government-owned operator', () => {
  const holders = 'Antofagasta Plc, 70%, and Marubeni Corp., 30%';
  const state = 'Corporación Nacional del Cobre (CODELCO) (Government, 100%)';
  assertReal('cl', holders);
  assertReal('cl', state);
  assert.deepEqual(edges(chapter('cl', [holders, state])).sort(), [
    'Antofagasta Plc owns Test site 0 70%',
    'Corporación Nacional del Cobre operates Test site 1',
    'Marubeni Corp. owns Test site 0 30%',
    'country:cl owns Corporación Nacional del Cobre 100%',
  ]);
});

test('Russia: Government with a share resolves to Russia; a plant name with no company stays unparsed', () => {
  const gazprom = 'PAO Gazprom (Government, 50.23%, and private owners, 49.77%)';
  assertReal('ru', gazprom);
  const got = buildUsgsRelations(chapter('ru', [gazprom, 'Achinskiy (United Co. RUSAL)']));
  const ids = got.relations.map((r) => `${r.from} ${r.type} ${r.to} ${r.share?.value ?? ''}`);
  // Gazprom is in the directory, so the endpoint is the directory's entity.
  assert.ok(ids.includes('country:ru owns company:gazprom 50.23'), ids.join('\n'));
  assert.equal(got.report.unparsed.length, 1);
  assert.match(got.report.unparsed[0].reason, /neither recognisably a company nor a facility/);
});

test('a joint venture of two holders, one marked operator', () => {
  const cell =
    'Joint venture of No. 1 Mining Enterprise (operator), 50%, and Wanbao Mining Ltd., 50%';
  assertReal('mm', cell);
  assert.deepEqual(edges(chapter('mm', [cell])).sort(), [
    'No. 1 Mining Enterprise operates Test site 0',
    'No. 1 Mining Enterprise owns Test site 0 50%',
    'Wanbao Mining Ltd. owns Test site 0 50%',
  ]);
});

test('a facility name at the head hands the operator role to the company in its bracket', () => {
  const cell = 'Gove open pit bauxite mine [Pacific Aluminium Pty. Ltd. (Rio Tinto Ltd., 100%)]';
  assertReal('au', cell);
  const got = edges(chapter('au', [cell]));
  assert.ok(got.includes('Pacific Aluminium Pty. Ltd. operates Test site 0'));
  // Rio Tinto is in the directory: its endpoint carries the directory id, not a minted one.
  assert.ok(
    got.includes('company:rio-tinto owns Pacific Aluminium Pty. Ltd. 100%'),
    got.join('\n'),
  );
});

test('unparsable strings make no edge and say why', () => {
  const cases: [string, string, RegExp][] = [
    ['kz', 'Kazzinc Ltd. [Glencore plc, 69.7%, and NMC Tau-Ken', /never closes/],
    ['cn', 'East Hope Group Co. Ltd., of which:', /of which/],
    [
      'id',
      'PT Hengjaya Nickel Industry and PT Ranger Nickel Industry (Nickel Industries Ltd., 80%)',
      /two companies/,
    ],
    ['cd', 'Artisanal and small-scale miners', /names no company/],
    ['mx', 'Minera y Metalúrgica, El Boleo S.A.P. I. de C.V. (MMB)', /comma inside the name/],
  ];
  for (const [iso2, cell, reason] of cases) {
    assertReal(iso2, cell);
    assert.throws(
      () => readCell(cell),
      (e: unknown) => e instanceof Unparsed && reason.test(e.message),
    );
    assert.deepEqual(edges(chapter(iso2, [cell])), [], cell);
  }
});

test('a row with no place printed makes no facility edge', () => {
  assert.equal(usgsFacilityId('br', 'NA'), null);
  assert.equal(usgsFacilityId('cn', 'Plants in multiple Provinces'), null);
  assert.match(usgsFacilityId('kz', 'Mine No. 9, Qostanay Province') ?? '', /^facility:usgs-kz-/);
});

test('every USGS relation quotes a cell the yearbook file prints, from its chapter', () => {
  const cells = new Map<string, Set<string>>();
  for (const c of USGS.countries)
    cells.set(c.url, new Set(c.facilities.map((f) => f.companies.replace(/\s+/g, ' ').trim())));
  const usgs = allRelations().filter((r) => r.origin === 'research');
  assert.ok(usgs.length > 1000, `only ${usgs.length} USGS relations`);
  for (const r of usgs)
    for (const e of r.evidence)
      assert.ok(cells.get(e.source)?.has(e.quote), `${r.id}: quote is not a cell of ${e.source}`);
});

test('research/usgs-relations.json is exactly what the script writes from the yearbook file', async () => {
  const committed = await readFile(OUTPUT, 'utf8');
  assert.equal(
    committed,
    usgsRelationsText(),
    'stale: run scripts/research/build-usgs-relations.ts',
  );
});

// =====================================================================
// THE STORE AND THE READ API
// =====================================================================

test('the corpus loads: every relation validates and USGS Kazakhstan reads as a chain', () => {
  const owners = relationsTo('company:jv-inkai-llp', { type: 'owns' });
  assert.deepEqual(owners.map((r) => [r.from, r.share?.value]).sort(), [
    ['company:cameco-corp', 40],
    ['company:nac-kazatomprom-jsc', 60],
  ]);
  const paths = pathsBetween('company:cameco-corp', 'company:nac-kazatomprom-jsc', { maxHops: 2 });
  assert.ok(paths.length >= 1 && paths[0].length === 2, 'Cameco and Kazatomprom co-own JV Inkai');
  assert.ok(neighbours('company:jv-inkai-llp').some((n) => n.direction === 'out'));
});

test('ownership holders become edges: a share is stated, a holder named without one is a lead', () => {
  const holders = relationsTo('company:asml', { type: 'owns' });
  assert.ok(holders.length >= 2 && holders.every((r) => r.grade === 'stated' && r.share));
  const leads = corpusRelations().relations.filter((r) => r.grade === 'lead');
  assert.ok(leads.length > 0 && leads.every((r) => !r.share));
  assert.equal(relationsTo('company:asml', { minGrade: 'stated' }).length, holders.length);
  const printed = relationEvidence(holders[0]);
  assert.match(printed.sources[0].reading, /not a verbatim quote/);
  assert.equal(printed.counted, true);
});

test('facility operators become edges', () => {
  const labarge = relationsFrom('company:exxonmobil', { type: 'operates' });
  assert.ok(labarge.some((r) => r.to === 'facility:labarge'));
});

test('two sources for one relation corroborate it; two shares conflict and the reviewed one is kept', () => {
  const research = stated({ origin: 'research' });
  const curated = stated({
    origin: 'curated',
    evidence: [
      {
        source: 'https://www.kazatomprom.kz/en/annual-report',
        quote: 'JV Inkai LLP — Kazatomprom 60%, Cameco 40%',
        readOn: today,
      },
    ],
  });
  const corpus = { relations: [], names: {}, skipped: {} };
  const empty = {
    source: '',
    readOn: '',
    report: buildUsgsRelations(chapter('kz', [])).report,
    nodes: {},
  };
  const merged = buildStore({ hand: [curated], corpus, usgs: { ...empty, relations: [research] } });
  const one = merged.byId.get(research.id)!;
  assert.equal(one.grade, 'corroborated');
  assert.equal(one.evidence.length, 2);
  assert.equal(relationEvidence(one, merged).gradeLabel, 'Stated by two independent sources');

  const other = stated({ origin: 'research', share: { value: 50, unit: 'percent' } });
  const conflict = buildStore({ hand: [curated], corpus, usgs: { ...empty, relations: [other] } });
  assert.equal(conflict.byId.get(other.id)!.share?.value, 60);
  assert.equal(conflict.conflicts.length, 1);

  const bad = stated({ origin: 'research', evidence: [] });
  assert.throws(
    () => buildStore({ hand: [], corpus, usgs: { ...empty, relations: [bad] } }),
    /relation problem/,
  );
});

test('a derived relation prints its rule and the chain it rests on', () => {
  const a = stated();
  const b = stated({
    from: 'company:jv-inkai-llp',
    type: 'operates',
    to: 'facility:labarge',
    share: undefined,
  });
  const d = stated({
    grade: 'derived',
    from: 'company:nac-kazatomprom-jsc',
    type: 'operates',
    to: 'facility:labarge',
    share: undefined,
    evidence: [],
    derivedFrom: [a.id, b.id],
    rule: 'majority owner of the operator',
  });
  const corpus = { relations: [], names: {}, skipped: {} };
  const empty = {
    source: '',
    readOn: '',
    report: buildUsgsRelations(chapter('kz', [])).report,
    nodes: {},
  };
  const s = buildStore({ hand: [a, b, d], corpus, usgs: { ...empty, relations: [] } });
  const printed = relationEvidence(s.byId.get(d.id)!, s);
  assert.equal(printed.counted, false);
  assert.equal(printed.rule, 'majority owner of the operator');
  assert.equal(printed.chain?.length, 2);
});

// =====================================================================
// THE CANDIDATE PATH
// =====================================================================

const QUOTE = 'JV Inkai LLP is owned 60% by Kazatomprom and 40% by Cameco Corporation.';

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    evidence: 'candidate',
    asOf: '2024',
    source: { url: 'PLACEHOLDER', quote: QUOTE, readOn: today },
    submittedBy: { agent: 'test', model: 'fixture', runId: 'run-1' },
    from: 'company:cameco-corp',
    to: 'company:jv-inkai-llp',
    type: 'owns',
    grade: 'stated',
    share: { value: 40, unit: 'percent' },
    ...overrides,
  };
}

test('the relation schema accepts a known endpoint and refuses an invented one or a misplaced share', () => {
  const { schema } = FACET_SPECS.relations;
  const ok = schema.safeParse(
    candidate({ source: { url: 'https://x.example/a', quote: QUOTE, readOn: today } }),
  );
  assert.ok(ok.success, JSON.stringify(ok.error?.issues));
  const src = { source: { url: 'https://x.example/a', quote: QUOTE, readOn: today } };
  assert.equal(
    schema.safeParse(candidate({ ...src, from: 'company:made-up-firm-zz' })).success,
    false,
  );
  assert.equal(schema.safeParse(candidate({ ...src, type: 'operates' })).success, false);
  assert.equal(schema.safeParse(candidate({ ...src, grade: 'corroborated' })).success, false);
  assert.equal(schema.safeParse(candidate({ ...src, to: 'company:cameco-corp' })).success, false);
});

test('add.ts relations: a quote on the page passes, one off the page exits 4, a known relation exits 5', async () => {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Annual report. ${QUOTE} Other text.`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/report`;
  try {
    const dir = await mkdtemp(path.join(tmpdir(), 'relations-'));
    await writeFile(path.join(dir, 'relations.json'), '[]\n');
    const read = async (u: string) => {
      const res = await fetch(u);
      return { ok: true as const, text: await res.text() };
    };
    const deps = { read, candidatesDir: dir, log: () => {} };
    const input = async (row: unknown) => {
      const file = path.join(dir, `in-${Math.random()}.json`);
      await writeFile(file, JSON.stringify([row]));
      return file;
    };
    const source = { url, quote: QUOTE, readOn: today };
    assert.equal(
      await run(['relations', await input(candidate({ source })), '--dry-run'], deps),
      EXIT.ok,
    );
    const off = { url, quote: 'Cameco owns all of JV Inkai and nobody else does.', readOn: today };
    assert.equal(
      await run(['relations', await input(candidate({ source: off })), '--dry-run'], deps),
      EXIT.quote,
    );
    const known = candidate({ source, asOf: '2023', share: { value: 40, unit: 'percent' } });
    assert.equal(await run(['relations', await input(known), '--dry-run'], deps), EXIT.duplicate);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('a relation id carries the commodity a flow states, and only then', () => {
  const base = { from: 'country:kz', type: 'ships_to', to: 'country:cn', asOf: '2024' } as const;
  assert.equal(relationId(base), 'country:kz|ships_to|country:cn|2024');
  const uranium = relationId({ ...base, volume: { commodity: 'Uranium (HS 2844)' } });
  const copper = relationId({ ...base, volume: { commodity: 'Refined copper' } });
  assert.equal(uranium, 'country:kz|ships_to|country:cn|2024|uranium-hs-2844');
  assert.equal(copper, 'country:kz|ships_to|country:cn|2024|refined-copper');
  assert.notEqual(uranium, copper);
});
