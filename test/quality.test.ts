/**
 * The data-quality gate.
 *
 * Every dataset has six written criteria (config/substrata-quality.ts); every
 * rule must be measured by a check and every check must answer a declared
 * rule. The pure checks run here, on the committed files, and their failure
 * counts are a ratchet: they may fall, never rise. When a fix lowers one,
 * lower its baseline in the same PR — the test fails until you do, so a gain
 * cannot quietly be given back later.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QUALITY_DATASETS } from '../config/substrata-quality';
import { DATABASE_CHECKS } from '../lib/quality/checks-db';
import { isFragment, sumProblems } from '../lib/quality/checks-resources';
import { quoteCarries } from '../lib/quality/checks-series';
import { namedIn } from '../lib/quality/checks-cross';
import { rowWindows } from '../lib/quality/network-registries';
import { networkResults } from '../lib/quality/network-results';
import { pureResults } from '../lib/quality/pure';
import { quoteParts } from '../lib/quality/page-text';
import { CRITERIA, overallScore, scoreOf, type CheckResult } from '../lib/quality/types';
import type { UsgsChapter } from '../lib/resources/usgs';

/** Failing rows per pure check on 2026-09-26, after the fixes in that PR. Absent = 0. */
const FAILURE_BASELINE: Record<string, number> = {
  'producers/sourced-maker': 8,
  'producers/row-source': 12,
  'producers/chokepoint-source': 18,
  'producers/in-usgs-yearbook': 1,
  'dependencies/binding-now-joined': 3,
  // Undated pages (Zeiss, TOK product pages), a BLS table and Wacker's annual report: no date printed.
  'series/point-source': 20,
  // The OECD inventory itself gives no instrument or start date for these.
  'oecd-restrictions/instrument': 2,
  'oecd-restrictions/start-date': 49,
  'usgs-producers/whole-cells': 5,
  // High-purity quartz, neon, boron: no USGS or EIA world table read yet.
  'usgs-mcs/resource-has-table': 3,
};

const pure = pureResults();

test('no pure check fails more rows than its baseline, and a lower count lowers the baseline', () => {
  for (const r of pure) {
    const allowed = FAILURE_BASELINE[r.check] ?? 0;
    const sample = r.failures
      .slice(0, 3)
      .map((f) => `${f.row}: ${f.problem}`)
      .join('; ');
    assert.ok(
      r.failures.length <= allowed,
      `${r.check}: ${r.failures.length} failing, baseline ${allowed} — ${sample}`,
    );
    assert.equal(
      r.failures.length,
      allowed,
      `${r.check} improved to ${r.failures.length}: lower FAILURE_BASELINE to match`,
    );
  }
  for (const id of Object.keys(FAILURE_BASELINE))
    assert.ok(
      pure.some((r) => r.check === id),
      `baseline names a check that no longer exists: ${id}`,
    );
});

test('every written rule is measured, and every check answers a written rule', () => {
  const all: Pick<CheckResult, 'dataset' | 'criterion' | 'check'>[] = [
    ...pure,
    ...networkResults([]),
    ...DATABASE_CHECKS,
  ];
  for (const d of QUALITY_DATASETS) {
    for (const c of CRITERIA) {
      const rule = d.criteria[c];
      const checks = all.filter((r) => r.dataset === d.id && r.criterion === c);
      if (typeof rule === 'string')
        assert.ok(checks.length > 0, `${d.id}/${c} is a rule nothing measures`);
      else {
        assert.ok(rule.na.length > 30, `${d.id}/${c}: say why it is not measured`);
        assert.equal(
          checks.length,
          0,
          `${d.id}/${c} is declared not measured but ${checks[0]?.check} measures it`,
        );
      }
    }
  }
  for (const r of all)
    assert.ok(
      QUALITY_DATASETS.some((d) => d.id === r.dataset),
      `${r.check}: unknown dataset`,
    );
  assert.equal(new Set(all.map((r) => r.check)).size, all.length, 'two checks share an id');
});

test('every failing row names itself and its problem, and links something to open', () => {
  for (const r of pure)
    for (const f of r.failures) {
      assert.ok(f.row && f.problem, `${r.check}: a failure without a row or problem`);
      assert.ok(f.link || f.page, `${r.check}: "${f.row}" links nothing a reader could open`);
    }
});

test('the score is rows held over rows looked at; unmeasured criteria are not counted as 100', () => {
  const r = (checked: number, passed: number) => ({ checked, passed }) as CheckResult;
  assert.equal(scoreOf([r(10, 9), r(10, 10)]), 95);
  assert.equal(scoreOf([r(0, 0)]), null);
  assert.equal(
    overallScore([
      { criterion: 'links', checked: 4, passed: 2, score: 50 },
      { criterion: 'freshness', checked: 0, passed: 0, score: null },
    ]),
    50,
  );
});

test('the gates can fail: each check catches the error it exists for', () => {
  const chapter = {
    columns: [{ key: 'mine:2025' }],
    rows: [
      { kind: 'country', name: 'A', cells: { 'mine:2025': { raw: '10', value: 10 } } },
      { kind: 'country', name: 'B', cells: { 'mine:2025': { raw: '900', value: 900 } } },
      { kind: 'world', name: 'World total', cells: { 'mine:2025': { raw: '100', value: 100 } } },
    ],
  } as unknown as UsgsChapter;
  assert.match(sumProblems(chapter)[0].problem ?? '', /sum to 910/);
  assert.equal(quoteCarries('backlog rose from 50 to 55 gigawatts', 55), true);
  assert.equal(quoteCarries('backlog rose from 50 to 55 gigawatts', 57), false);
  assert.equal(quoteCarries('revenue of $1.2 billion', 1200), true);
  assert.equal(quoteCarries('China exported no gallium at all in May', 0), true);
  assert.equal(isFragment('Chibuluma South Mine, about'), true);
  assert.equal(isFragment('plc, 78%) (Amplats)'), true);
  assert.equal(isFragment('eMalahleni plant'), false);
  assert.equal(isFragment('Lynas Rare Earths Ltd.'), false);
  assert.equal(
    namedIn('Lynas Rare Earths', [], 'Lynas Malaysia Sdn. Bhd. (Lynas Rare Earths Ltd., 100%)'),
    true,
  );
  assert.equal(namedIn('QatarEnergy', [], 'Ras Laffan Liquefied Natural Gas Co.'), false);
  assert.deepEqual(quoteParts('Metal 8,890 / 11,400.'), ['metal 8,890', '11,400']);
});

test('a USGS row whose footnote pushed its values down a line is still read as one row', () => {
  const text = [
    'Argentina                5',
    '            13,800   23,000        4,400,000',
    'Australia   82,700   92,000',
  ].join('\n');
  const argentina = rowWindows(text).find((w) => w.head.startsWith('argentina'));
  assert.ok(argentina?.text.includes('13,800') && argentina.text.includes('4,400,000'));
  assert.ok(!argentina?.text.includes('82,700'), 'the next country leaked into the row');
});
