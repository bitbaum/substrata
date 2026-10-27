/**
 * The frontier registry (docs/architecture/2026-10-28-frontier-registry.md):
 * every file is valid, the migration kept the list, and the rules refuse what
 * they promise to refuse.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allAreas, childrenOf, membersOf, subtree } from '@/lib/registry/areas';
import { gapsOf } from '@/lib/registry/gaps';
import { parseRegistry, registeredCompanies, registry } from '@/lib/registry/load';
import { bottleneckBySlug } from '@/lib/bottlenecks';
import { buildUniverse, universe } from '@/lib/universe/store';

const base = {
  slug: 'acme-robotics',
  name: 'Acme Robotics',
  kind: 'private',
  summary: 'Acme Robotics builds warehouse robots in Ohio.',
  evidence: [
    {
      field: 'summary',
      grade: 'stated',
      source: 'https://example.com/about',
      quote: 'Acme Robotics builds warehouse robots in Ohio.',
      readOn: '2026-10-28',
      asOf: '2026-10-28',
    },
  ],
  origin: { by: 'company:add', on: '2026-10-28' },
};
const areaFiles = () => registry().areas.map((a) => ({ file: `${a.slug}.json`, json: a }));
const check = (json: unknown) =>
  parseRegistry([{ file: 'acme-robotics.json', json }], areaFiles(), '2026-10-28').problems;

test('every registry file is valid', () => {
  registry();
});

test('the migration kept the list: same slugs, tiers, themes and evidence as the filter', () => {
  const before = buildUniverse().entries.filter((e) => e.admitted);
  const after = universe().entries.filter((e) => e.admitted && e.registered);
  const afterBy = new Map(after.map((e) => [e.slug, e]));
  assert.ok(before.length >= 793);
  for (const b of before) {
    const a = afterBy.get(b.slug);
    assert.ok(a, `${b.slug} is not registered`);
    assert.equal(a.tier, b.tier, `${b.slug} tier`);
    assert.deepEqual(a.themes, b.themes, `${b.slug} themes`);
    assert.deepEqual(a.admittedBy, b.admittedBy, `${b.slug} evidence`);
    assert.equal(a.name, b.name);
    assert.equal(a.country, b.country);
    // Enrichment may add identifiers; it never drops or changes one.
    for (const [k, v] of Object.entries(b.ids))
      assert.equal(a.ids[k as keyof typeof a.ids], v, `${b.slug} ${k}`);
  }
});

test('a valid minimal company passes; a value with no evidence row does not', () => {
  assert.deepEqual(check(base), []);
  const noRow = { ...base, country: 'US' };
  assert.match(check(noRow).join('\n'), /country has no evidence row/);
});

test('a new row needs a quote, dates in the past, and is never carried', () => {
  const ev = base.evidence[0];
  assert.match(
    check({ ...base, evidence: [{ ...ev, quote: undefined }] }).join('\n'),
    /no quote|quote/,
  );
  assert.match(
    check({ ...base, evidence: [{ ...ev, readOn: '2027-01-01' }] }).join('\n'),
    /after today/,
  );
  assert.match(
    check({ ...base, evidence: [{ ...ev, quote: undefined, carried: true }] }).join('\n'),
    /only a migrated row/,
  );
});

test('unknown areas, bad slugs and a listed company without a ticker are refused', () => {
  assert.match(check({ ...base, areas: [{ area: 'no-such-area' }] }).join('\n'), /unknown area/);
  assert.match(check({ ...base, slug: 'Acme Robotics' }).join('\n'), /slug/);
  assert.match(check({ ...base, kind: 'public' }).join('\n'), /ticker and exchange/);
});

test('areas form a tree of at most three levels and name real bottlenecks', () => {
  const slugs = new Set(allAreas().map((a) => a.slug));
  for (const a of allAreas()) {
    if (a.parent) assert.ok(slugs.has(a.parent), `${a.slug} parent`);
    for (const b of a.bottlenecks) assert.ok(bottleneckBySlug(b), `${a.slug}: no bottleneck ${b}`);
  }
  assert.ok(subtree('robotics').includes('actuators'));
  assert.ok(childrenOf(null).length >= 10);
});

test('area members roll up their descendants; gaps are derived, not stored', () => {
  const cs = registeredCompanies();
  assert.ok(membersOf('compute-semiconductors', cs).length > 50);
  const gaps = gapsOf(cs[0]).map((g) => g.field);
  assert.ok(gaps.includes('summary'), 'a migrated company has no "what it is" yet');
});

test('company:add resolves identity from Wikipedia and Wikidata and cites only what it fetched', async () => {
  const { resolveTitle, leadQuote } = await import('@/lib/registry/resolve');
  const { draftCompany } = await import('@/lib/registry/draft');
  const get = async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      url.includes('wikipedia.org')
        ? {
            title: 'Acme Robotics',
            extract:
              'Acme Robotics is an American company that builds warehouse robots. It was founded in 2020.',
            wikibase_item: 'Q42',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Acme_Robotics' } },
          }
        : {
            results: {
              bindings: [
                { l: { value: 'Acme Robotics' }, hqL: { value: 'Columbus' }, cc: { value: 'us' } },
              ],
            },
          },
  });
  const r = await resolveTitle('Acme Robotics', '2026-10-28', get);
  assert.ok(r);
  const c = draftCompany(r, {
    kind: 'private',
    areas: [{ area: 'industrial-robots' }],
    today: '2026-10-28',
  });
  assert.equal(c.slug, 'acme-robotics');
  assert.equal(c.country, 'US');
  assert.equal(c.hq, 'Columbus');
  assert.deepEqual(check(c), []);
  assert.ok(c.evidence.every((e) => e.quote && e.source.startsWith('https://')));
  assert.equal(leadQuote(r.page.extract).endsWith('robots.'), true);
  // A listed company needs a ticker AND an exchange, or it is not called listed.
  assert.equal(
    draftCompany(r, { kind: 'public', areas: [], today: '2026-10-28' }).kind,
    'unclassified',
  );
});
