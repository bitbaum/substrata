/**
 * Company stubs (lib/entities/sources/company-stubs.ts): every minted
 * `company:` node a counted relation touches is an entity with a page, built
 * from the graph at load, saying nothing the relations do not — and it
 * changes neither the graph it came from nor the ranking of what is profiled.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  allEntities,
  entitiesOfKind,
  resolveDirectoryEntity,
  resolveEntity,
  resolveIn,
  resolveInDirectory,
} from '../lib/entities/registry';
import { IDENTIFIED_EVIDENCE, isIdentified, isStub, STUB_EVIDENCE } from '../lib/entities/types';
import { sourceLabel, stubRelations } from '../lib/entities/sources/company-stubs';
import { graphNode, graphStore, isCounted } from '../lib/graph/index';
import { buildStore } from '../lib/graph/store';
import { resolveParty } from '../lib/graph/parties';
import { eventProblems } from '../lib/event-rules';
import { graphEndpoint } from '../lib/entry/vocab';
import { search } from '../lib/search';
import { searchDocuments } from '../lib/search/corpus';
import { ROUTES } from '../lib/links';
import type { CoverageEvent } from '../config/substrata-events';

const stubs = entitiesOfKind('company').filter(isStub);

test('the Kazakh uranium operators and owners are stub companies with a page (or promoted to tier B)', () => {
  for (const [id, name] of [
    ['company:nac-kazatomprom-jsc', 'NAC Kazatomprom JSC'],
    ['company:uranium-one-inc', 'Uranium One Inc.'],
    ['company:jv-inkai-llp', 'JV Inkai LLP'],
  ] as const) {
    const e = resolveEntity(id);
    assert.ok(e, `${id} does not resolve`);
    assert.equal(e.name, name);
    // Kazatomprom is also held by a uranium fund, so the universe identifies
    // it (tier B, lib/universe): promoted in place, same slug, same sentence.
    assert.ok([STUB_EVIDENCE, IDENTIFIED_EVIDENCE].includes(e.evidence), `${id}: ${e.evidence}`);
    assert.equal(e.href, `/markets/${id.slice('company:'.length)}`);
    assert.ok(e.topics.includes('kz'), `${id}: the Kazakhstan table printed it`);
    // Other sources may join (the pilot's own Kazatomprom rows do): the
    // yearbook leads, and the tail is whatever the relations say.
    assert.match(
      e.summary,
      /^Named in the USGS Minerals Yearbook 2023 \(Kazakhstan\)( and \d+ other sources?)? as /,
    );
    assert.equal(resolveDirectoryEntity(id), undefined, 'a stub is not a directory entity');
  }
  const kap = resolveEntity('company:nac-kazatomprom-jsc')!.summary;
  assert.match(kap, /holder of a stake in Akbastau JV, APPAK LLP/);
  assert.match(kap, /shipper to China/);
  assert.match(
    resolveEntity('company:jv-inkai-llp')!.summary,
    /operator of one listed site and held by Cameco Corp\. and NAC Kazatomprom JSC/,
  );
});

test('a reviewed alias resolves to the canonical stub and is never a stub of its own', () => {
  assert.equal(resolveIn('company', 'NAC Kazatomp JSC')?.id, 'company:nac-kazatomprom-jsc');
  assert.equal(resolveIn('company', 'UraniumOne Inc.')?.id, 'company:uranium-one-inc');
  assert.equal(resolveEntity('company:nac-kazatomp-jsc'), undefined);
  assert.deepEqual(resolveEntity('company:nac-kazatomprom-jsc')!.aka, ['NAC Kazatomp JSC']);
});

test('a node no source places in a country says so, and invents no country', () => {
  const e = resolveEntity('company:blackrock');
  assert.ok(e && isStub(e));
  assert.match(e.retrievalText, /No source states a country\./);
  assert.deepEqual(graphNode(e.id).iso2, []);
  assert.match(e.summary, /^Named in a page on sec\.gov as holder of a stake in /);
});

test('every stub rests on a counted relation and says only what the relations say', () => {
  assert.ok(stubs.length > 1000, `${stubs.length} stubs`);
  const patterns = ROUTES.map((r) => new RegExp(`^${r.replace(/:[^/]+/g, '[^/]+')}$`));
  for (const e of stubs) {
    const rows = stubRelations(e.id);
    assert.ok(rows.length > 0 && rows.every(isCounted), `${e.id}: no counted relation`);
    assert.match(e.summary, /^Named in .+ as .+\.$/, `${e.id}: ${e.summary}`);
    assert.equal(graphNode(e.id).inDirectory, false, `${e.id}: a stub read as directory`);
    assert.ok(
      patterns.some((p) => p.test(e.href)),
      `${e.id}: ${e.href} is not a route`,
    );
    assert.deepEqual(
      e.sources,
      [...new Set(rows.flatMap((r) => r.evidence.map((x) => x.source)))],
      `${e.id}: a source the relations do not cite`,
    );
  }
});

test('the stubs never change the graph they are built from', () => {
  // Built now, with the stubs in the registry, the graph must equal the one
  // the stubs were built from: its producers resolve against the directory only.
  allEntities();
  const again = buildStore();
  assert.deepEqual(
    again.all.map((r) => r.id),
    graphStore().all.map((r) => r.id),
  );
  assert.deepEqual(resolveParty('NAC Kazatomprom JSC'), {
    id: 'company:nac-kazatomprom-jsc',
    minted: true,
  });
  assert.equal(resolveInDirectory('company', 'NAC Kazatomprom JSC'), undefined);
});

test('search finds a stub by name and ranks it below a profiled company', () => {
  assert.equal(search('NAC Kazatomprom JSC').hits[0]?.id, 'company:nac-kazatomprom-jsc');
  const rio = search('rio tinto', { limit: 5 }).hits.map((h) => h.id);
  assert.equal(rio[0], 'company:rio-tinto', `a profiled company first: ${rio.join(', ')}`);
  const docs = searchDocuments().filter((d) => d.id.startsWith('company:'));
  for (const d of docs) {
    const e = resolveEntity(d.id)!;
    const stub = isStub(e);
    // A stub and a tier B company (identified, not profiled) both rank below a profile.
    assert.equal(d.weight !== undefined, stub || isIdentified(e), `${d.id}: weight`);
    if (stub) assert.equal(d.meta, 'named in sources · no profile yet');
    if (isIdentified(e)) assert.equal(d.meta, 'identified · not profiled');
  }
});

const event = (participants: string[]): CoverageEvent => ({
  id: '2025-01-15-kazatomprom-production',
  date: '2025-01-15',
  headline: 'Kazatomprom reports production',
  kind: 'capacity',
  effect: 'neutral',
  bottlenecks: ['Uranium conversion and enrichment'],
  participants,
  jurisdictions: ['KZ'],
  source: 'https://www.kazatomprom.kz/en',
  quote: 'A quoted sentence long enough to carry the claim.',
  primary: true,
  acceptedOn: '2025-01-16',
});

test('an event and a relation may name a stub; a typo or an invention may not', () => {
  const participant = (p: string[]) =>
    eventProblems(event(p)).filter((x) => /participant directory/.test(x));
  assert.deepEqual(participant(['NAC Kazatomprom JSC', 'JV Inkai LLP']), []);
  assert.equal(participant(['NAC Kazatomp JSC']).length, 1, 'the alias spelling is not a name');
  assert.equal(participant(['Kazakh Uranium Holdings Ltd']).length, 1);
  // BlackRock is minted from a corpus ownership row, not a USGS node: the stub opens it.
  assert.equal(graphEndpoint.safeParse('company:blackrock').success, true);
  assert.equal(graphEndpoint.safeParse('company:not-a-firm-anywhere').success, false);
});

test('a source is named the way a sentence can use it', () => {
  assert.equal(
    sourceLabel('https://pubs.usgs.gov/myb/vol3/2023/myb3-2023-kazakhstan.xlsx'),
    'the USGS Minerals Yearbook 2023 (Kazakhstan)',
  );
  assert.equal(sourceLabel('https://www.sec.gov/x'), 'a page on sec.gov');
});

test('a field that extends a directory row refuses a stub', async () => {
  const { companySlug, companyName } = await import('../lib/entry/vocab');
  assert.equal(companySlug.safeParse('nac-kazatomprom-jsc').success, false);
  assert.equal(companyName.safeParse('NAC Kazatomprom JSC').success, false);
  assert.equal(companySlug.safeParse('asml').success, true);
});
