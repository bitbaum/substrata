/**
 * The starter questions, pinned: generated from every facet of the corpus,
 * never typed; four tiles never share a facet; the set rotates with the date
 * and differs between the home page and /chat; every question names a thing
 * the site has a page for; and no country is special-cased anywhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { CHAT_STARTERS } from '../config/substrata-chat';
import { resolveEntity, allEntities } from '../lib/entities/registry';
import { resourcesWithData } from '../lib/resources/usgs';
import {
  FACETS,
  LABEL_MAX,
  candidates,
  fits,
  hash,
  seedFor,
  starters,
  type Facet,
} from '../lib/starters';

const ROOT = new URL('..', import.meta.url).pathname;

function days(from: string, n: number): string[] {
  const start = new Date(`${from}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
}

/** Every facet with data in the corpus today. */
const withData = FACETS.filter((f) => candidates(f).length > 0);
/**
 * Every facet that can be a tile today: it has a candidate whose label fits.
 * Talent has one bottleneck with a readable job board, "REBCO superconducting
 * tape, 12 mm", whose label is 49 characters — so it is skipped, never
 * clipped, until a shorter name gains a board.
 */
const open = withData.filter((f) => candidates(f).some(fits));

test('every facet but talent has candidates; talent only when a board is read', () => {
  for (const f of FACETS) if (f !== 'talent') assert.ok(candidates(f).length > 0, f);
});

test('every generated question names a thing the site has a page for', () => {
  const byHref = new Map(allEntities().map((e) => [e.href.split('?')[0], e]));
  const byName = new Map(allEntities().map((e) => [`${e.kind}:${e.name}`, e]));
  const resources = new Set(resourcesWithData());
  for (const facet of withData) {
    for (const s of candidates(facet)) {
      assert.ok(
        s.question.toLowerCase().includes(s.about.toLowerCase()),
        `${facet}: "${s.question}" names "${s.about}"`,
      );
      assert.ok(s.href.startsWith('/'), s.href);
      if (facet === 'material') {
        // A material is a USGS table, served at /resources/<id>; it has no
        // entity of its own, so the page is the thing it must resolve to.
        const id = s.href.replace('/resources/', '');
        assert.ok(resources.has(id), `${s.about} has a USGS table`);
        continue;
      }
      const kind =
        facet === 'company'
          ? 'company'
          : facet === 'country'
            ? 'country'
            : facet === 'policy'
              ? 'policy'
              : facet === 'science'
                ? 'science'
                : facet === 'capital'
                  ? 'capital'
                  : 'bottleneck';
      const entity = byName.get(`${kind}:${s.about}`);
      assert.ok(entity, `${facet}: "${s.about}" is a ${kind} in the registry`);
      assert.equal(s.href, entity.href, `${facet}: "${s.about}" links to its page`);
      assert.ok(resolveEntity(entity.id));
      if (facet !== 'policy') assert.ok(byHref.has(s.href.split('?')[0]), s.href);
    }
  }
});

test('four tiles never share a facet; no label is clipped or over the limit, 60 days', () => {
  for (const seed of days('2026-10-01', 60)) {
    const set = starters({ seed });
    assert.equal(set.length, 4, seed);
    assert.equal(new Set(set.map((s) => s.facet)).size, 4, `${seed}: one facet twice`);
    for (const s of set) {
      assert.ok(!s.label.includes('…'), `${seed}: "${s.label}" is clipped`);
      assert.ok(!s.label.includes('...'), `${seed}: "${s.label}" is clipped`);
      assert.ok(s.label.length <= LABEL_MAX, `${seed}: "${s.label}" is ${s.label.length}`);
      assert.ok(s.label.length > 0);
    }
  }
});

test('a name too long for a tile is passed over for the next in its facet, never clipped', () => {
  // A facet with nothing that fits is skipped for the seed, not clipped into a tile.
  for (const f of withData)
    if (!candidates(f).some(fits))
      for (const seed of days('2026-10-01', 30))
        assert.ok(
          !starters({ seed }).some((s) => s.facet === f),
          `${f} shown with no fitting label`,
        );
  // The science entry "Diamond heat spreaders in production packaging" does
  // not fit; it is never a tile, but its question is still in the pool.
  const tooLong = candidates('science').filter((s) => !fits(s));
  assert.ok(tooLong.length > 0);
  for (const seed of days('2026-10-01', 60))
    for (const s of starters({ seed })) assert.ok(!tooLong.some((t) => t.label === s.label));
});

test('tile labels follow one short template per facet', () => {
  const pick = (f: Facet) => candidates(f)[0];
  assert.match(pick('bottleneck').label, /^What eases .+\?$/);
  assert.match(pick('company').label, /^What does .+ hold\?$/);
  assert.match(pick('country').label, /^What does .+ hold\?$/);
  assert.match(
    pick('policy').label,
    /^(US|EU|China|Japan|South Korea|Taiwan|Netherlands|UK|Germany|Switzerland) \d{4} [a-z ]+: what changes\?$/,
  );
  assert.ok(candidates('policy').every(fits), 'every rule fits a tile');
  assert.match(pick('science').label, /^How close is [a-z0-9]/);
  assert.match(
    pick('capital').label,
    /^What could (DOE Loan Programs Office|EIB|KfW|JBIC) move\?$/,
  );
  assert.match(pick('events').label, /^.+: what changed\?$/);
  assert.match(pick('material').label, /^Who produces [a-z]/);
  if (candidates('talent').length) assert.match(pick('talent').label, /^Who is hiring for .+\?$/);
});

test('materials a tracked bottleneck depends on come first; oil does not lead', () => {
  const labels = candidates('material').map((s) => s.about.toLowerCase());
  assert.ok(labels.includes('lithium'));
  assert.ok(!labels.includes('oil'), 'oil has no tracked bottleneck');
});

test('the set is the same for the same seed and different the next day', () => {
  assert.deepEqual(starters({ seed: '2026-10-23' }), starters({ seed: '2026-10-23' }));
  const [a, b] = days('2026-10-23', 2).map((seed) => starters({ seed }));
  assert.notDeepEqual(
    a.map((s) => s.question),
    b.map((s) => s.question),
  );
});

test('every facet with data appears within fourteen days', () => {
  const seen = new Set<Facet>();
  for (const seed of days('2026-10-23', 14)) for (const s of starters({ seed })) seen.add(s.facet);
  for (const f of open) assert.ok(seen.has(f), `${f} never offered in fourteen days`);
});

test('within a facet the question moves between days', () => {
  const asked = new Set<string>();
  for (const seed of days('2026-10-01', 60))
    for (const s of starters({ seed })) if (s.facet === 'company') asked.add(s.about);
  assert.ok(asked.size >= 5, `companies asked about in 60 days: ${[...asked].join(', ')}`);
});

test('/chat opened from the home page shows a different four, none of the home ones', () => {
  const date = '2026-10-23';
  const home = starters({ seed: date });
  const chat = starters({
    seed: seedFor(new Date(`${date}T10:00:00Z`), '/'),
    exclude: home.map((s) => s.question),
  });
  assert.equal(seedFor(new Date(`${date}T10:00:00Z`)), date);
  assert.equal(seedFor(new Date(`${date}T10:00:00Z`), '/'), `${date}|/`);
  assert.notDeepEqual(
    home.map((s) => s.question),
    chat.map((s) => s.question),
  );
  for (const s of chat)
    assert.ok(!home.some((h) => h.question === s.question), `${s.label} shown twice`);
});

test('facets and count are honoured; an empty choice falls back to the typed list', () => {
  const two = starters({ seed: '2026-10-23', facets: ['company', 'science'], count: 2 });
  assert.deepEqual(two.map((s) => s.facet).sort(), ['company', 'science']);
  assert.equal(starters({ seed: '2026-10-23', count: 2 }).length, 2);
  const none = starters({ seed: '2026-10-23', facets: ['talent'] });
  if (candidates('talent').length === 0) assert.equal(none.length, 3);
  const typed = starters({ seed: '2026-10-23', facets: [] });
  assert.deepEqual(
    typed.map((s) => s.question),
    CHAT_STARTERS.map((s) => s.question),
  );
});

test('the hash is stable and spreads', () => {
  assert.equal(hash('a'), hash('a'));
  assert.notEqual(hash('a'), hash('b'));
});

test('no country is special-cased: Niger is corpus data, never a typed question', () => {
  const typed = JSON.stringify(CHAT_STARTERS);
  assert.ok(!/Niger/.test(typed), 'the fallback list names a country');
  assert.ok(!('home' in CHAT_STARTERS[0]), 'the fallback list has no hand-picked home tiles');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mjs)$/.test(f) ? [p] : [];
    });
  for (const dir of ['app', 'components'])
    for (const file of walk(join(ROOT, dir)))
      assert.ok(!/Niger/.test(readFileSync(file, 'utf8')), `${file} names Niger`);
  assert.ok(!/Niger/.test(readFileSync(join(ROOT, 'lib/starters.ts'), 'utf8')));
  assert.ok(!/Niger/.test(readFileSync(join(ROOT, 'lib/home-asks.ts'), 'utf8')));
});
