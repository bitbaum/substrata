import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EVENTS } from '../config/substrata-events';
import { buildChunks } from '../lib/index/build';
import { makeChunk, type Chunk } from '../lib/index/chunk';
import { countryName } from '../lib/index/chunks/ids';
import { rank } from '../lib/index/retrieve';
import { KIND_WEIGHT, nameKeys, namedShare, queryUnits } from '../lib/rank-priority';
import { plain, search, searchDocuments, type SearchDoc } from '../lib/search';
import { words } from '../lib/search/text';

/**
 * A material's own page must not be pushed down by the events filed about it
 * (lib/rank-priority.ts). The regression: MOFCOM Announcement 46 of 2024, a
 * real sourced event, put "Gallium, refined" fourth for "gallium china".
 */
const GALLIUM = 'Gallium, refined';
const MOFCOM_46 = '2024-12-03-mofcom-announcement-46-gallium-germanium-us';

const at = (q: string, title: string, type: string, docs?: SearchDoc[]) =>
  search(q, docs ? { documents: docs, limit: 200 } : { limit: 200 }).hits.findIndex(
    (h) => h.type === type && plain(h.title) === title,
  );

test('the MOFCOM Announcement 46 event is in the corpus', () => {
  assert.ok(EVENTS.some((e) => e.id === MOFCOM_46));
});

test('with the gallium event present, "gallium china" has the Gallium bottleneck first or second', () => {
  const i = at('gallium china', GALLIUM, 'bottleneck');
  assert.ok(i >= 0 && i < 2, `Gallium, refined is #${i + 1}`);
  const firstEvent = search('gallium china').hits.findIndex((h) => h.type === 'event');
  assert.ok(firstEvent > i, 'an event outranks the bottleneck it is about');
});

/** N events about gallium in China, each worded to hold every query word, in title and body. */
function syntheticEvents(n: number): SearchDoc[] {
  return Array.from({ length: n }, (_, k) => ({
    id: `event:synthetic-${k}`,
    type: 'event' as const,
    title: `China tightens gallium exports again, round ${k}: gallium licences in China cut`,
    aka: [],
    summary: `Chinese gallium producers in China report gallium shipments ${k} down.`,
    body: `${GALLIUM} China CN Policy Tightens`,
    href: `/events#synthetic-${k}`,
    meta: '2026-01-01 · Tightens',
  }));
}

for (const n of [1, 10, 50, 200]) {
  test(`${n} synthetic gallium events never push the Gallium bottleneck out of the top 3`, () => {
    const docs = [...searchDocuments(), ...syntheticEvents(n)];
    const i = at('gallium china', GALLIUM, 'bottleneck', docs);
    assert.ok(i >= 0 && i < 3, `Gallium, refined is #${i + 1} with ${n} events`);
  });
}

test('the Ask retrieval: the Gallium page outranks every gallium event, even with 50 more', () => {
  const extra: Chunk[] = Array.from({ length: 50 }, (_, k) =>
    makeChunk({
      id: `event:synthetic-${k}`,
      facet: 'event',
      entityIds: ['bottleneck:gallium-refined', 'country:cn'],
      title: `China tightens gallium exports again, round ${k}`,
      text: `China tightens gallium exports again — tightens ${GALLIUM} (policy). Jurisdictions: China.`,
      href: '/events',
      evidence: 'sourced',
      asOf: '2026-10-01',
      significance: 0.7,
    }),
  );
  const hits = rank([...buildChunks(), ...extra], 'gallium china', { k: 80 });
  const page = hits.findIndex((h) => h.chunk.facet === 'entity' && h.chunk.title === GALLIUM);
  const event = hits.findIndex((h) => h.chunk.facet === 'event');
  assert.ok(page >= 0 && page < 5, `the Gallium page is #${page + 1}`);
  assert.ok(event > page, `an event (#${event + 1}) outranks the Gallium page (#${page + 1})`);
});

test('the event’s own words still find the event first', () => {
  for (const q of ['MOFCOM announcement 46', 'mofcom 46 gallium']) {
    const first = search(q).hits[0];
    assert.equal(first?.id, `event:${MOFCOM_46}`, `${q} → ${first && plain(first.title)}`);
  }
  const hit = rank(buildChunks(), 'MOFCOM announcement 46', { k: 1 })[0];
  assert.equal(hit?.chunk.id.startsWith('event:'), true, hit?.chunk.id);
});

test('across the corpus, no event outranks the bottleneck it names for "<material> <country>"', () => {
  const seen = new Set<string>();
  for (const e of EVENTS)
    for (const b of e.bottlenecks)
      for (const j of e.jurisdictions) {
        const q = `${nameKeys(b, [], words)[1] ?? b} ${countryName(j)}`;
        if (seen.has(q)) continue;
        seen.add(q);
        const hits = search(q, { limit: 200 }).hits;
        const page = hits.findIndex((h) => h.type === 'bottleneck' && plain(h.title) === b);
        if (page < 0) continue;
        const event = hits.findIndex((h) => h.type === 'event');
        assert.ok(
          event < 0 || event > page,
          `"${q}": an event is #${event + 1}, ${b} #${page + 1}`,
        );
      }
});

test('a name key is the name, the head of the name, or another spelling', () => {
  assert.deepEqual(nameKeys('Gallium, refined', [], words), ['gallium refined', 'gallium']);
  assert.deepEqual(nameKeys('Liquid helium (He-4)', ['LHe'], words), [
    'liquid helium he 4',
    'liquid helium',
    'lhe',
  ]);
  assert.deepEqual(nameKeys('Shin-Etsu Quartz', [], words), ['shin etsu quartz']);
});

test('the named share counts the query words a name run covers, and nothing a sentence holds', () => {
  assert.equal(namedShare(['gallium refined', 'gallium'], ['gallium', 'china']), 0.5);
  assert.equal(namedShare(['china', 'cn'], ['gallium', 'china']), 0.5);
  assert.equal(namedShare(['liquid helium'], ['liquid', 'helium', 'qatar']), 2 / 3);
  assert.equal(namedShare(['china tightens gallium exports'], ['gallium', 'china']), 0);
});

test('kind priority: bottleneck > country > company > science > event > note', () => {
  const order = ['bottleneck', 'country', 'company', 'science', 'event', 'note'];
  for (let i = 1; i < order.length; i++)
    assert.ok(KIND_WEIGHT[order[i - 1]] > KIND_WEIGHT[order[i]], `${order[i - 1]} > ${order[i]}`);
});

test('a country named in several words is one unit of the query, and counts as one', () => {
  const q = ['gallium', 'united', 'state', 'america'];
  const units = queryUnits(q, new Set(['united state america', 'united state']));
  assert.deepEqual(units, [[0], [1, 2, 3]]);
  assert.equal(namedShare(['gallium refined', 'gallium'], q, units), 0.5);
  const i = at('gallium United States of America', GALLIUM, 'bottleneck');
  const firstEvent = search('gallium United States of America').hits.findIndex(
    (h) => h.type === 'event',
  );
  assert.ok(i >= 0 && i < 3, `Gallium, refined is #${i + 1}`);
  assert.ok(firstEvent < 0 || firstEvent > i, `an event is #${firstEvent + 1}`);
});
