import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allEntities } from '../lib/entities/registry';
import { plain, search, searchDocuments, type SearchType } from '../lib/search';

/**
 * What a reader types, and what should come first. Each pair is from the real
 * corpus: the ranking is free to change as the corpus grows, these are the
 * answers a person would call wrong if they moved.
 *
 * `top` is the title that must be the first hit; `within` loosens that to the
 * first N for a query that is honestly ambiguous ("gallium china" is the
 * bottleneck, the Chinese export control and China all at once).
 */
const PAIRS: { q: string; top: string; type: SearchType; within?: number }[] = [
  { q: 'ASML', top: 'ASML', type: 'company' },
  { q: 'asml', top: 'ASML', type: 'company' },
  { q: 'EUV', top: 'EUV lithography scanners', type: 'bottleneck', within: 3 },
  { q: 'quartz', top: 'Crucible-grade high-purity quartz sand', type: 'bottleneck' },
  { q: 'transformer lead time', top: 'Large power transformer slots', type: 'bottleneck' },
  { q: 'gallium china', top: 'Gallium, refined', type: 'bottleneck', within: 3 },
  // A typo: no word "photresist" exists, so it is corrected, not dropped.
  { q: 'photresist', top: 'Photoresist', type: 'glossary', within: 2 },
  { q: 'photresist', top: 'Photoresist formulation', type: 'bottleneck', within: 2 },
  { q: 'Japan', top: 'Japan', type: 'country' },
  { q: 'china', top: 'China', type: 'country' },
  // An ISO code is an alias for its country.
  { q: 'cn', top: 'China', type: 'country' },
  { q: 'Zeiss', top: 'Carl Zeiss SMT', type: 'company' },
  { q: 'Shin-Etsu Quartz', top: 'Shin-Etsu Quartz', type: 'company' },
  {
    q: 'silicon carbide',
    top: 'Silicon carbide substrate, 200 mm semi-insulating',
    type: 'bottleneck',
  },
  // Prefix: results while the word is still being typed.
  { q: 'transfo', top: 'Large power transformer slots', type: 'bottleneck', within: 3 },
  { q: 'qualification', top: 'Qualification', type: 'glossary' },
  { q: 'severity', top: 'Severity', type: 'glossary' },
  { q: 'rare earth', top: 'Rare earths', type: 'glossary', within: 5 },
  {
    q: 'germanium',
    top: 'Announcement No. 23 of 2023 on export controls for gallium- and germanium-related items',
    type: 'policy',
  },
  { q: 'nanoimprint', top: 'Nanoimprint lithography', type: 'science' },
  { q: 'Wolfspeed', top: 'Wolfspeed', type: 'company' },
  // Half-typed: the common completion ("china"), not the rare one ("Chalco").
  { q: 'gallium ch', top: 'Gallium, refined', type: 'bottleneck' },
];

for (const { q, top, type, within = 1 } of PAIRS) {
  test(`search "${q}" → ${type} "${top}"${within > 1 ? ` in the top ${within}` : ''}`, () => {
    const { hits } = search(q);
    const first = hits.slice(0, within).map((h) => `${h.type}: ${plain(h.title)}`);
    assert.ok(
      first.includes(`${type}: ${top}`),
      `expected ${type} "${top}", got:\n  ${hits
        .slice(0, 5)
        .map((h) => `${h.type}: ${plain(h.title)} (${h.score})`)
        .join('\n  ')}`,
    );
  });
}

test('every entity kind is searchable, plus events and the glossary', () => {
  const types = new Set(searchDocuments().map((d) => d.type));
  for (const t of [
    'bottleneck',
    'company',
    'country',
    'policy',
    'science',
    'event',
    'note',
    'glossary',
  ])
    assert.ok(types.has(t as SearchType), `no ${t} documents in the index`);
  assert.ok(searchDocuments().length > allEntities().length);
});

test('ids are unique and every href is internal', () => {
  const docs = searchDocuments();
  assert.equal(new Set(docs.map((d) => d.id)).size, docs.length);
  for (const d of docs) assert.ok(d.href.startsWith('/'), `${d.id} → ${d.href}`);
});

test('an event is findable by what it names and links to its anchor', () => {
  const hit = search('ASML').hits.find((h) => h.type === 'event');
  assert.ok(hit, 'the ASML shipments event should be found');
  assert.match(hit.href, /^\/events#\d{4}-\d{2}-\d{2}-/);
});

test('a name outranks an alias, which outranks the body', () => {
  const docs = [
    {
      id: 'a',
      type: 'company' as const,
      title: 'Other',
      aka: [],
      summary: 'mentions zorblax once',
      body: '',
      href: '/a',
      meta: '',
    },
    {
      id: 'b',
      type: 'company' as const,
      title: 'Zorblax',
      aka: [],
      summary: '',
      body: '',
      href: '/b',
      meta: '',
    },
    {
      id: 'c',
      type: 'company' as const,
      title: 'Third',
      aka: ['Zorblax Inc'],
      summary: '',
      body: '',
      href: '/c',
      meta: '',
    },
  ];
  assert.deepEqual(
    search('zorblax', { documents: docs }).hits.map((h) => h.id),
    ['b', 'c', 'a'],
  );
});

test('every hit shows why it matched: a marked title, or else a marked passage', () => {
  const { hits } = search('quartz', { limit: 50 });
  assert.ok(hits[0].title.some((s) => s.hit && /quartz/i.test(s.text)));
  const bodyOnly = hits.filter((h) => !h.title.some((s) => s.hit));
  assert.ok(bodyOnly.length > 0, 'the query should reach some documents only through their text');
  for (const h of bodyOnly)
    assert.ok(
      h.snippet.some((s) => s.hit),
      `${plain(h.title)} has no marked passage`,
    );
});

test('snippets never quote a source URL', () => {
  for (const q of ['ASML', 'quartz', 'gallium'])
    for (const h of search(q, { limit: 50 }).hits)
      assert.ok(!/https?:\/\//.test(plain(h.snippet)), `${plain(h.title)}: ${plain(h.snippet)}`);
});

test('counts per type add up to the total, and a type filter narrows hits only', () => {
  const all = search('quartz');
  const sum = Object.values(all.counts).reduce((n, c) => n + (c ?? 0), 0);
  assert.equal(sum, all.total);
  const companies = search('quartz', { type: 'company' });
  assert.ok(companies.hits.length > 0);
  assert.ok(companies.hits.every((h) => h.type === 'company'));
  assert.equal(companies.total, all.total);
});

test('a correction is reported, and a real word is never corrected', () => {
  assert.equal(search('photresist').corrected, 'photoresist');
  assert.equal(search('quartz').corrected, null);
});

test('nonsense finds nothing, and an empty query is empty', () => {
  assert.equal(search('xyzzyunmatched').total, 0);
  assert.equal(search('   ').total, 0);
});

test('a query with no single match for every word falls back to the closest', () => {
  const r = search('ASML xyzzyunmatched');
  assert.equal(r.partial, true);
  assert.equal(plain(r.hits[0].title), 'ASML');
});
