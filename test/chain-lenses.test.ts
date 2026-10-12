/**
 * Six readings of every chain — overview, markets, research, money, people,
 * policy — each built from records: no placeholder words, links that go
 * where they say, and the facts the records hold stated the way they hold them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BOTTLENECKS, bottleneckBySlug, type Bottleneck } from '../lib/bottlenecks';
import { neighbors } from '../lib/graph';
import { chainFlow, chainHref } from '../app/atlas/chain-data';
import { chainStory } from '../app/atlas/chain-story';
import { LENS_IDS, chainLenses, isLens, type Lens } from '../app/atlas/lenses';

const lensesOf = (b: Bottleneck) =>
  chainLenses(b, chainStory(b, chainFlow(b, ''), neighbors('bottleneck', b.slug)));
const lens = (slug: string, id: string): Lens =>
  lensesOf(bottleneckBySlug(slug)!).find((l) => l.id === id)!;
const words = (l: Lens) =>
  [
    ...l.means,
    ...l.figures.flatMap((f) => [f.label, f.value, f.note ?? '']),
    ...l.groups.flatMap((g) => [
      g.title,
      ...g.items.flatMap((i) => [i.title, i.meta ?? '', i.text ?? '']),
    ]),
  ].join('\n');

test('every chain reads six ways, in order, with nothing left unfilled', () => {
  for (const b of BOTTLENECKS) {
    const all = lensesOf(b);
    assert.deepEqual(
      all.map((l) => l.id),
      [...LENS_IDS],
      b.slug,
    );
    for (const l of all) {
      assert.ok(
        l.means.length > 0 && l.means.every((m) => m.trim().length > 20),
        `${b.slug}/${l.id}`,
      );
      assert.doesNotMatch(words(l), /undefined|NaN|\[object|null\b/, `${b.slug}/${l.id}`);
      assert.ok(l.more.length > 0, `${b.slug}/${l.id} says where all of it lives`);
      for (const m of l.more) assert.ok(m.href.startsWith('/'), `${b.slug}/${l.id}: ${m.href}`);
      for (const g of l.groups)
        for (const i of g.items)
          if (i.href)
            assert.ok(
              i.external ? /^https?:\/\//.test(i.href) : i.href.startsWith('/'),
              `${b.slug}/${l.id}: ${i.title} → ${i.href}`,
            );
    }
  }
});

test('overview: the research claim, the four tests in words, the analyst’s rationale', () => {
  const euv = bottleneckBySlug('euv-lithography-scanners')!;
  const o = lens(euv.slug, 'overview');
  assert.equal(o.means[0], euv.why);
  const tests = o.groups.find((g) => g.title.startsWith('Why it scores'))!;
  assert.equal(tests.items.filter((i) => i.meta?.endsWith('the worst on this test')).length, 4);
  assert.ok(tests.items.some((i) => i.text === euv.rationale));
  assert.match(lens('gallium-refined', 'overview').means.join(' '), /The grade that matters: 4N/);
});

test('markets: the listed maker by ticker, and what a stop reaches', () => {
  const m = lens('euv-lithography-scanners', 'markets');
  assert.match(m.means[0], /Its only maker on record is listed: ASML \(ASML [A-Z]+\)/);
  assert.match(m.means[1], /Leading-edge foundry capacity and Advanced packaging capacity/);
  const exposed = Number(m.figures.find((f) => f.label === 'Companies exposed')!.value);
  assert.ok(exposed > 5);
  assert.ok(m.groups.some((g) => g.title === 'Key numbers' && g.items.length > 0));
  assert.match(
    lens('semiconductor-process-engineers', 'markets').means.join(' '),
    /No company on file is exposed/,
  );
});

test('research and money: readiness from the pipeline, and money said plainly', () => {
  assert.match(
    lens('euv-lithography-scanners', 'research').means[0],
    /nanoimprint lithography, at readiness 6 of 9/,
  );
  const ga = lens('gallium-refined', 'research');
  assert.ok(ga.groups.some((g) => g.title === 'Could anything replace it'));
  assert.ok(
    !ga.groups.some((g) => g.items.some((i) => i.meta?.endsWith('substitute'))),
    'substitutes are not listed as technologies',
  );
  assert.match(
    lens('euv-lithography-scanners', 'money').means[0],
    /^Money is not the constraint\./,
  );
  assert.match(lens('gallium-refined', 'money').means[0], /has not been judged/);
});

test('people and policy: the work and where to train; the maker’s own country first', () => {
  const p = lens('euv-lithography-scanners', 'people');
  assert.match(p.means[0], /kinds of work: .*optics/);
  assert.ok(p.groups.find((g) => g.title === 'Where to train')!.items.length > 0);
  const policy = lens('gallium-refined', 'policy');
  const restrictions = policy.groups.find((g) => g.title.startsWith('Export restrictions'))!;
  assert.match(restrictions.items[0].title, /^China:/, 'China, where it is made, before Kenya');
  assert.match(
    lens('euv-lithography-scanners', 'policy').means.join(' '),
    /the Netherlands, where it is made/,
  );
});

test('the lens rides in the URL, and the overview is the bare chain', () => {
  assert.equal(chainHref('x', undefined, undefined, 'overview'), '/atlas?chain=x');
  assert.equal(chainHref('x', undefined, undefined, 'people'), '/atlas?chain=x&lens=people');
  assert.ok(isLens('markets') && !isLens('sats') && !isLens(undefined));
});
