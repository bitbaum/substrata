/**
 * The company universe: the rule (admit), the answer for any name
 * (whyCompany), and that what it admits reaches the registry, search, the
 * Ask and the pages — on fixtures for the rule, on the committed evidence for
 * the rest.
 */
import { registeredCompany } from '@/lib/registry/load';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONSIDERED } from '../config/universe-considered';
import { FUNDS, SIC_THEMES, WIKIDATA_INDUSTRIES } from '../config/universe-sources';
import { SIZE_FLOORS, THEME_IDS } from '../config/universe-themes';
import { runTool } from '../lib/chat-tools/registry';
import { emptyLedger } from '../lib/chat-tools/ledger';
import { memoryDemand, useDemandLedger } from '../lib/dossier/demand';
import { resolveDirectoryEntity, resolveEntity } from '../lib/entities/registry';
import { IDENTIFIED_EVIDENCE } from '../lib/entities/types';
import { admit } from '../lib/universe/admit';
import { displayName, universeEntries } from '../lib/universe/store';
import type { UniverseRow } from '../lib/universe/types';
import { whyCompany } from '../lib/universe/why';

const today = '2026-10-25';

function row(over: Partial<UniverseRow> & Pick<UniverseRow, 'establishes'>): UniverseRow {
  return {
    company: 'acme-robotics',
    name: 'ACME ROBOTICS INC',
    family: 'fund',
    evidence: 'candidate',
    asOf: '2026-10-23',
    source: {
      url: 'https://example.com/holdings.csv',
      quote: 'a holdings row long enough to quote',
      readOn: today,
    },
    submittedBy: { agent: 'test', model: 'unrecorded', runId: 't' },
    ...over,
  };
}

const holding = row({
  establishes: {
    theme: 'robotics',
    themeBasis: 'fund',
    ids: { ticker: 'ACME', exchange: 'US' },
    size: { basis: 'fund-position', usd: 12_000_000 },
  },
});

test('one holdings row passes all three tests: tier B, with every reason cited', () => {
  const d = admit({ slug: 'acme-robotics', name: 'Acme Robotics', rows: [holding] }, { today });
  assert.equal(d.admitted, true);
  assert.equal(d.tier, 'B');
  assert.deepEqual(d.themes, ['robotics']);
  assert.deepEqual(d.failed, []);
  for (const a of d.admittedBy) assert.ok(a.source && a.quote, `${a.test} carries its source`);
});

test('a theme without a size is considered, not admitted, and says which test failed', () => {
  const themeOnly = row({
    family: 'registry',
    establishes: { theme: 'space', ids: { qid: 'Q1' } },
  });
  const d = admit({ slug: 'x', name: 'X', rows: [themeOnly] }, { today });
  assert.equal(d.admitted, false);
  assert.equal(d.tier, null);
  assert.deepEqual(d.failed, ['materiality']);
  assert.match(d.tests.materiality.reason, /No cited size figure/);
});

test('a figure under its floor fails, naming the floor', () => {
  const small = row({
    establishes: { ...holding.establishes, size: { basis: 'fund-position', usd: 900_000 } },
  });
  const d = admit({ slug: 'x', name: 'X', rows: [small] }, { today });
  assert.deepEqual(d.failed, ['materiality']);
  assert.match(d.tests.materiality.reason, /under the US\$5\.0 million floor/);
});

test('a stale fund file is set aside, with its age, before the tests run', () => {
  const old = row({ ...holding, asOf: '2026-01-02' });
  const d = admit({ slug: 'x', name: 'X', rows: [old] }, { today });
  assert.equal(d.admitted, false);
  assert.deepEqual(d.failed, ['theme', 'materiality', 'identity']);
  assert.match(d.setAside[0].why, /296 days old; a fund source counts for 120 days/);
});

test('tier A: a hand-verified chain role admits without a fund; identity is still reported', () => {
  const d = admit(
    {
      slug: 'y',
      name: 'Y',
      rows: [],
      chainRole: { role: 'EUV optics', source: 'https://y.example', themes: ['compute'] },
    },
    { today },
  );
  assert.equal(d.tier, 'A');
  assert.deepEqual(d.failed, ['identity']);
});

test('the rule is consistent with itself: every fund, code and class names a real theme', () => {
  for (const f of FUNDS) assert.ok(THEME_IDS.includes(f.theme), f.id);
  for (const s of SIC_THEMES) assert.ok(THEME_IDS.includes(s.theme), s.sic);
  for (const w of WIKIDATA_INDUSTRIES) assert.ok(THEME_IDS.includes(w.theme), w.qid);
  assert.equal(new Set(SIZE_FLOORS.map((f) => f.basis)).size, SIZE_FLOORS.length);
  assert.equal(new Set(FUNDS.map((f) => f.id)).size, FUNDS.length);
});

test('names print as the company writes them, not as a holdings file shouts them', () => {
  assert.equal(displayName('SPACE EXPLORATION TECHN-CL A'), 'Space Exploration Techn');
  assert.equal(displayName('NAC KAZATOMPROM JSC-GDR REGS'), 'NAC Kazatomprom JSC');
  assert.equal(displayName('Tesla, Inc.'), 'Tesla, Inc.');
});

test('the owner’s question answers itself from the committed evidence', () => {
  const nvidia = whyCompany('NVIDIA', { file: false });
  assert.equal(nvidia.status, 'in');
  assert.equal(nvidia.status === 'in' && nvidia.tier, 'A');
  for (const name of ['SpaceX', 'Tesla', 'NuScale', 'Oklo', 'X-energy']) {
    const m = whyCompany(name, { file: false });
    assert.equal(m.status, 'in', `${name}: ${JSON.stringify(m).slice(0, 200)}`);
  }
  const spacex = whyCompany('SpaceX', { file: false });
  assert.ok(spacex.status === 'in' && spacex.themes.includes('Space & launch'));
  // Registered by hand since: a private company is now on the list on its own cited identity.
  assert.equal(whyCompany('Figure AI', { file: false }).status, 'in');
});

test('a name nobody has looked at files a gap task, and the demand is counted', () => {
  const previous = useDemandLedger(memoryDemand());
  try {
    const m = whyCompany('Zzyzx Imaginary Robotics');
    assert.equal(m.status, 'queued');
    if (m.status !== 'queued') return;
    assert.equal(m.task.id, 'company:zzyzx-imaginary-robotics#universe');
    assert.equal(m.task.box, 'universe');
    assert.match(m.task.writeTo, /config\/candidates\/universe\.json/);
  } finally {
    const ledger = useDemandLedger(previous);
    assert.equal(ledger.count('company:zzyzx-imaginary-robotics', 'universe'), 1);
  }
});

test('no considered name is also admitted (the list must leave the file the day it is)', () => {
  for (const c of CONSIDERED) {
    const m = whyCompany(c.name, { file: false });
    assert.equal(
      m.status,
      'considered',
      `${c.name} is now ${m.status}: remove it from config/universe-considered.ts`,
    );
  }
});

test('every tier B company is a registry entity with a page, cited on all three tests', () => {
  const b = universeEntries().filter((e) => e.tier === 'B');
  assert.ok(b.length >= 150, `only ${b.length} tier B companies`);
  for (const e of b) {
    if (e.registered && registeredCompany(e.slug)?.origin.by !== 'migration') {
      assert.ok(e.admittedBy.length > 0, `${e.slug}: registered with no evidence`);
      continue; // a registered company is in because it is registered, not by the old three tests
    }
    for (const t of ['theme', 'materiality', 'identity'] as const)
      assert.ok(
        e.tests[t].evidence.some((a) => a.source),
        `${e.slug}: ${t}`,
      );
    const entity = resolveEntity(`company:${e.slug}`);
    if (!entity || entity.evidence !== IDENTIFIED_EVIDENCE) continue; // a directory company
    assert.equal(entity.href, `/markets/${e.slug}`);
    assert.equal(
      resolveDirectoryEntity(entity.id),
      undefined,
      'tier B is derived, never directory',
    );
  }
  // Every theme has someone in it (photonics, today, only through tier A and SIC 3827).
  const themes = new Set(
    universeEntries()
      .filter((e) => e.admitted)
      .flatMap((e) => e.themes),
  );
  for (const t of THEME_IDS) assert.ok(themes.has(t), `no admitted company in ${t}`);
});

test('the Ask can answer "why is X on the list" with the company_membership tool', async () => {
  const ran = await runTool('company_membership', { company: 'Oklo' }, { ledger: emptyLedger() });
  const out = JSON.parse(ran.result) as {
    status: string;
    admitted_by: { test: string; source: string }[];
  };
  assert.match(out.status, /^in — tier B/);
  assert.ok(
    out.admitted_by.some((a) => a.test === 'materiality' && a.source.startsWith('https://')),
  );
});
