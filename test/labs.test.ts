/**
 * The `lab` kind: an institute, university group or national laboratory. The
 * candidate schema, the add.ts gate for `labs`, how a lab row becomes an
 * entity, and the dossier boxes it fills — the country's people-and-labs box
 * and the lab's own four. No lab is seeded: every row here is a fixture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

import { extractReadableText } from '@bitbaum/ai-kit/web';

import { LABS, type Lab } from '../config/substrata-labs';
import { FACET_SPECS, LabEntry } from '../lib/entry/schemas';
import { labFromCandidate, type LabCandidate } from '../lib/entry/candidate';
import { labEntities } from '../lib/entities/sources/lab';
import { ENTITY_SOURCES } from '../lib/entities/sources';
import { entitiesOfKind } from '../lib/entities/registry';
import { ROUTES } from '../lib/links';
import { graphEndpoint } from '../lib/entry/vocab';
import { peopleLabs } from '../lib/dossier/counters/country';
import { LAB_COUNTERS } from '../lib/dossier/counters/lab';
import { boxDefinition, boxStatus } from '../lib/dossier/definitions';
import { computeDossier } from '../lib/dossier/compute';
import { modulesFor } from '../lib/profile/modules';
import { EXIT, run, type PageRead } from '../scripts/research/add';

const today = new Date().toISOString().slice(0, 10);
const QUOTE = 'The institute studies in-situ recovery chemistry for uranium deposits.';

const row = (overrides: Record<string, unknown> = {}) => ({
  evidence: 'candidate',
  asOf: '2025',
  source: { url: 'https://www.example.edu/', quote: QUOTE, readOn: today },
  submittedBy: { agent: 'test', model: 'fixture', runId: 'run-1' },
  id: 'example-institute',
  name: 'Example Institute of Nuclear Physics',
  type: 'institute',
  place: 'kz',
  where: 'Almaty',
  worksOn: [{ bottleneck: 'Uranium conversion and enrichment', what: QUOTE }],
  url: 'https://www.example.edu/',
  join: 'https://www.example.edu/jobs',
  ...overrides,
});

test('no lab is seeded, and the source says why it may be empty', () => {
  assert.deepEqual(LABS, []);
  const source = ENTITY_SOURCES.find((s) => s.kind === 'lab');
  assert.ok(source?.allowEmpty?.reason);
});

test('the lab schema takes a good row and refuses what the site cannot resolve', () => {
  assert.equal(LabEntry.safeParse(row()).success, true);
  assert.equal(LabEntry.safeParse(row({ join: null, where: undefined })).success, true);
  const refused = {
    'an unknown bottleneck': row({ worksOn: [{ bottleneck: 'Unobtainium', what: QUOTE }] }),
    'no line of work': row({ worksOn: [] }),
    'an upper-case country': row({ place: 'KZ' }),
    'a country the site lacks': row({ place: 'zz' }),
    'a type outside the set': row({ type: 'think-tank' }),
    'a sourced claim': row({ evidence: 'sourced' }),
    'a funding field': row({ funding: [{ funder: 'NSF' }] }),
    'no source quote': row({ source: { url: 'https://x.example', quote: 'short', readOn: today } }),
  };
  for (const [why, r] of Object.entries(refused))
    assert.equal(LabEntry.safeParse(r).success, false, `accepted ${why}`);
  assert.equal(FACET_SPECS.labs.key(row() as LabCandidate), 'example-institute');
});

test('a lab row becomes an entity with a page, and an endpoint a relation may name', () => {
  const lab = labFromCandidate(row() as LabCandidate);
  assert.equal(lab.source, 'https://www.example.edu/');
  assert.equal(lab.quote, QUOTE);
  assert.equal(lab.evidence, 'candidate');
  const [entity] = labEntities([lab]);
  assert.equal(entity.id, 'lab:example-institute');
  assert.equal(entity.href, '/labs/example-institute');
  assert.match(entity.summary, /^Research institute in Kazakhstan working on Uranium conversion/);
  assert.ok(ROUTES.includes('/labs/:slug'));
  // The id shape is accepted; the endpoint must still exist on the site.
  assert.equal(graphEndpoint.safeParse('lab:example-institute').success, false);
  assert.match(String(graphEndpoint.safeParse('lab:x').error?.issues[0].message), /not an entity/);
  const ids = modulesFor(entity).map((m) => m.id);
  for (const id of ['lab-work', 'lab-join', 'lab-funding', 'discussion'])
    assert.ok(ids.includes(id));
});

test('the country counts its labs; a candidate lab is a lead and fills nothing', () => {
  const candidate = labFromCandidate(row() as LabCandidate);
  const promoted: Lab = { ...candidate, id: 'promoted', evidence: undefined };
  const box = boxDefinition('country', 'people_labs')!;
  assert.equal(box.writeTo.facet, 'labs');
  const leads = peopleLabs('kz', [candidate]);
  assert.equal(leads.lead, 1);
  assert.equal(boxStatus(leads, box.thresholds), 'empty');
  const one = peopleLabs('kz', [candidate, promoted]);
  assert.equal(one.stated, 1);
  assert.equal(boxStatus(one, box.thresholds), 'thin');
  const three = peopleLabs(
    'kz',
    [1, 2, 3].map((n) => ({ ...promoted, id: `p${n}` })),
  );
  assert.equal(boxStatus(three, box.thresholds), 'full');
  assert.equal(peopleLabs('ne', [promoted]).stated, 0, 'another country’s lab');
  assert.equal(
    computeDossier('country:kz')!.boxes.find((b) => b.box === 'people_labs')!.status,
    'empty',
  );
});

test('a lab’s own boxes write lab rows; research fronts keep theirs under science', () => {
  for (const box of ['works_on', 'where', 'how_to_join'])
    assert.equal(boxDefinition('lab', box)?.writeTo.facet, 'labs', `${box} writes labs`);
  assert.equal(boxDefinition('lab', 'funding')?.writeTo.facet, 'relations');
  assert.equal(LabEntry.safeParse(boxDefinition('lab', 'works_on')!.example).success, true);
  const subject = {
    id: 'lab:none',
    kind: 'lab',
    key: 'none',
    name: 'None',
    href: '/labs/none',
  } as const;
  assert.match(LAB_COUNTERS.works_on(subject).basis, /not in the lab register/);
  assert.equal(computeDossier('lab:not-a-lab'), null);
  const front = entitiesOfKind('science')[0];
  const dossier = computeDossier(front.id)!;
  assert.equal(dossier.subject.kind, 'science');
  assert.deepEqual(
    dossier.boxes.map((b) => b.box),
    ['works_on', 'where', 'how_to_join', 'funding'],
  );
});

/** A plain fetch: ai-kit's SSRF guard rightly refuses 127.0.0.1. */
async function localRead(url: string): Promise<PageRead> {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, reason: String(res.status) };
  return { ok: true, text: extractReadableText(await res.text(), 2_000_000).text };
}

test('add.ts labs: the quote must be on the page; a good row lands; the same row exits 5', async () => {
  let html = '<html><body><p>Another sentence entirely.</p></body></html>';
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/lab`;
  try {
    const dir = await mkdtemp(path.join(tmpdir(), 'labs-'));
    await writeFile(path.join(dir, 'labs.json'), '[]\n');
    const file = path.join(dir, 'input.json');
    await writeFile(file, JSON.stringify([row({ source: { url, quote: QUOTE, readOn: today } })]));
    const deps = { read: localRead, candidatesDir: dir, log: () => {} };
    assert.equal(await run(['labs', file, '--dry-run'], deps), EXIT.quote);
    html = `<html><body><h1>Example</h1><p>${QUOTE}</p></body></html>`;
    assert.equal(await run(['labs', file], deps), EXIT.ok);
    const written = JSON.parse(await readFile(path.join(dir, 'labs.json'), 'utf8'));
    assert.deepEqual(
      written.map((r: { id: string }) => r.id),
      ['example-institute'],
    );
    assert.equal(await run(['labs', file], deps), EXIT.duplicate);
    await writeFile(file, JSON.stringify([row({ place: 'KZ' })]));
    assert.equal(await run(['labs', file], deps), EXIT.schema);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
