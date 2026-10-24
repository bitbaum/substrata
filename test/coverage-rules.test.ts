/**
 * The inference rules (lib/coverage/rules.ts) on the real graph and on one
 * fixture: what fires, what it is graded, and that nothing they propose is
 * ever counted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { RELATIONS } from '../config/substrata-relations';
import { computeDossier } from '../lib/dossier/compute';
import type { RelationCounter } from '../lib/dossier/relations';
import { coOwnership, registryBridge, sameParent } from '../lib/coverage/rules';
import { isCounted, relationEvidence } from '../lib/graph/index';
import { buildStore, graphStore } from '../lib/graph/store';
import { buildUsgsRelations } from '../lib/graph/usgs-operators';
import { relationProblems } from '../lib/graph/validate';
import type { Relation } from '../lib/graph/types';
import { derivedRelationsText, OUTPUT } from '../scripts/research/build-derived-relations';

const base = () => buildStore({ hand: RELATIONS, derived: { relations: [] } });
const KZ_URANIUM = 'facility:usgs-kz-1pdpe5i';

test('research/derived-relations.json is exactly what the script writes', async () => {
  assert.equal(
    await readFile(OUTPUT, 'utf8'),
    derivedRelationsText(),
    'stale: run scripts/research/build-derived-relations.ts',
  );
});

test('co-ownership fires on the Kazakh uranium rows: Kazatomprom holds an interest, no share invented', () => {
  const s = base();
  const r = coOwnership(s).find(
    (x) => x.from === 'company:nac-kazatomprom-jsc' && x.to === KZ_URANIUM,
  )!;
  assert.ok(r, 'the rule fired');
  assert.equal(r.grade, 'derived');
  assert.equal(r.rule, 'co-ownership');
  // Sixteen ventures, one capacity, no stake of any venture in the place: no share.
  assert.equal(r.share, undefined);
  assert.ok(r.derivedFrom!.includes('company:nac-kazatomprom-jsc|owns|company:jv-inkai-llp|2023'));
  assert.ok(r.derivedFrom!.includes(`company:jv-inkai-llp|operates|${KZ_URANIUM}|2023`));
  assert.deepEqual(relationProblems(r), []);
});

test('co-ownership multiplies two stated stakes, and only then', () => {
  const s = base();
  const withShare = coOwnership(s).filter((r) => r.share);
  assert.ok(withShare.length > 0);
  for (const r of withShare) {
    const [up, down] = [
      r.derivedFrom!.map((id) => s.byId.get(id)!).find((p) => p.from === r.from)!,
      r.derivedFrom!.map((id) => s.byId.get(id)!).find((p) => p.to === r.to && p.type === 'owns')!,
    ];
    assert.equal(
      r.share!.value,
      Math.round(up.share!.value * down.share!.value * 100) / 10000,
      r.id,
    );
  }
});

test('same-parent proposes leads between operators, never a counted edge', () => {
  const leads = sameParent(base());
  const pair = leads.find(
    (r) => r.from === 'company:jv-inkai-llp' && r.to === 'company:jv-katco-llp',
  )!;
  assert.ok(pair);
  assert.equal(pair.grade, 'lead');
  assert.equal(pair.type, 'shares_parent_with');
  assert.ok(leads.every((r) => !isCounted(r) && !r.from.startsWith('country:')));
  assert.equal(relationEvidence(pair, base()).chain?.length, 2);
});

test('registry bridge: a minted name matching a GLEIF-evidenced entity is a lead, never a merge', () => {
  const day = '2026-10-01';
  const gleif: Relation = {
    id: 'company:acme-holdings-plc|owns|company:acme-mining-llc|2026',
    from: 'company:acme-holdings-plc',
    to: 'company:acme-mining-llc',
    type: 'owns',
    grade: 'stated',
    asOf: '2026',
    evidence: [
      {
        source: 'https://api.gleif.org/api/v1/lei-records/X/direct-parent-relationship',
        quote: 'IS_DIRECTLY_CONSOLIDATED_BY ACTIVE',
        readOn: day,
      },
    ],
  };
  const minted: Relation = {
    id: 'company:acme-mining-ltd|operates|facility:usgs-kz-acme|2023',
    from: 'company:acme-mining-ltd',
    to: 'facility:usgs-kz-acme',
    type: 'operates',
    grade: 'stated',
    asOf: '2023',
    evidence: [
      {
        source: 'https://pubs.usgs.gov/x',
        quote: 'Acme Mining Ltd.',
        readOn: day,
        reading: 'table-cell',
      },
    ],
    origin: 'research',
  };
  const s = buildStore({
    hand: [gleif],
    corpus: { relations: [], names: { 'company:acme-mining-llc': 'Acme Mining LLC' }, skipped: {} },
    usgs: {
      source: '',
      readOn: '',
      report: buildUsgsRelations({ source: '', retrieved: day, countries: [] }).report,
      nodes: {
        'company:acme-mining-ltd': { name: 'Acme Mining Ltd.', kind: 'company', iso2: ['kz'] },
      },
      relations: [minted],
    },
  });
  const leads = registryBridge(s);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].from, 'company:acme-mining-ltd');
  assert.equal(leads[0].to, 'company:acme-mining-llc');
  assert.equal(leads[0].type, 'may_be_same_as');
  assert.equal(leads[0].grade, 'lead');
  // Never merged: both nodes keep their own edges.
  assert.equal(s.from.get('company:acme-mining-ltd')!.length, 1);
  // The committed graph has no registry-evidenced relation yet, so the rule proposes nothing there.
  assert.equal(registryBridge(base()).length, 0);
});

test('a rule-only type is never anything but a lead', () => {
  const lead = sameParent(base())[0];
  assert.match(relationProblems({ ...lead, grade: 'stated' }).join(), /only ever a lead/);
});

test('proposals never raise a completeness count', () => {
  const s = graphStore();
  assert.ok(s.proposals.length > 0);
  for (const r of s.proposals) assert.ok(!s.byId.has(r.id), 'held apart from the walked relations');
  // A counter that DOES see the proposals, against one that does not: the
  // derived and lead tallies move, the counted rows and every status do not.
  const counter = (rows: readonly Relation[]): RelationCounter => ({
    count(subject, query) {
      const out = { stated: 0, corroborated: 0, derived: 0, lead: 0 };
      for (const r of rows)
        if (
          query.types.includes(r.type) &&
          (query.direction === 'out' ? r.from === subject : r.to === subject)
        )
          out[r.grade] += 1;
      return out;
    },
  });
  for (const id of ['country:kz', 'company:nac-kazatomprom-jsc', 'country:ne']) {
    const before = computeDossier(id, { relations: counter(s.all) });
    const after = computeDossier(id, { relations: counter([...s.all, ...s.proposals]) });
    const shape = (d: typeof before) =>
      JSON.stringify(d?.boxes.map((b) => [b.box, b.status, b.counted]));
    assert.equal(shape(after), shape(before), id);
  }
});
