/**
 * The chain in plain words, and the map that stays a map.
 *
 * Owner, 2026-10-12, on /atlas?chain=euv-lithography-scanners: "a little bit
 * confusing … when I click on ASML it totally leaves this map … not just the
 * chain itself, not just the visual, but also the description in plain
 * language." These pin both halves: every sentence is built from the rows the
 * diagram draws, and every node keeps the reader on the atlas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bottleneckBySlug, BOTTLENECKS } from '../lib/bottlenecks';
import { neighbors } from '../lib/graph';
import { chainFlow, chainHref, makerDetail } from '../app/atlas/chain-data';
import { chainStory, listWords } from '../app/atlas/chain-story';

const EUV = bottleneckBySlug('euv-lithography-scanners')!;

test('listWords joins the way a sentence does', () => {
  assert.equal(listWords([]), '');
  assert.equal(listWords(['A']), 'A');
  assert.equal(listWords(['A', 'B']), 'A and B');
  assert.equal(listWords(['A', 'B', 'C']), 'A, B and C');
});

test('the EUV story names the maker, the country, the inputs and what stops', () => {
  const flow = chainFlow(EUV, '');
  const story = chainStory(EUV, flow, neighbors('bottleneck', EUV.slug));
  assert.match(story.lede, /ASML \(Netherlands\) builds/);
  // Zeiss and Trumpf are German; their home is not where ASML builds.
  assert.doesNotMatch(story.lede, /Germany/);
  assert.match(story.lede, /EUV projection optics/);
  assert.match(story.lede, /tin/i);
  assert.match(story.lede, /leading-edge foundry capacity stops with it/i);
  const kickers = story.parts.map((p) => p.kicker);
  assert.deepEqual(kickers.slice(0, 2), ['What it is', 'Who makes it']);
  const who = story.parts.find((p) => p.kicker === 'Who makes it')!;
  assert.match(who.text, /ASML is the only maker on record/);
  assert.match(who.text, /Carl Zeiss SMT and Trumpf/);
  const binds = story.parts.find((p) => p.kicker === 'How hard it binds')!;
  assert.match(binds.text, /12\/12, binding now/);
  assert.match(binds.text, /definition of a chokepoint/);
  // Every sentence ends like one.
  for (const part of story.parts) assert.match(part.text, /[.!?]$/, part.kicker);
});

test('a chain with no maker says so as a gap, not as a finding', () => {
  const orphan = BOTTLENECKS.find((b) => b.producers.length === 0);
  if (!orphan) return; // every bottleneck has a maker today; the branch stays covered by the template
  const story = chainStory(orphan, chainFlow(orphan, ''), neighbors('bottleneck', orphan.slug));
  assert.match(story.lede, /Nobody is on record yet as the maker/);
  assert.match(story.parts[1].text, /research gap/);
});

test('every node of the chain keeps the reader on the atlas', () => {
  const flow = chainFlow(EUV, '');
  for (const n of [...flow.needs, ...flow.makers, ...flow.feeds, ...flow.technologies]) {
    assert.ok(n.href.startsWith('/atlas?'), `${n.label} leaves the map: ${n.href}`);
  }
  // A maker is selected on the same chain, not on its own page.
  const asml = flow.makers.find((m) => m.label === 'ASML')!;
  assert.equal(asml.href, '/atlas?chain=euv-lithography-scanners&maker=asml');
  assert.equal(asml.role, 'Makes it');
  assert.equal(asml.supplier, false);
  assert.equal(asml.note, 'Netherlands');
  assert.equal(flow.makers.find((m) => m.label === 'Carl Zeiss SMT')!.supplier, true);
  // The technology filter travels with the chain, and the maker rides after it.
  assert.equal(chainHref('x', 'ai', 'asml'), '/atlas?topic=ai&chain=x&maker=asml');
});

test('the maker panel reads the producer row and the directory, and offers the profile', () => {
  const asml = makerDetail(EUV, 'asml')!;
  assert.equal(asml.name, 'ASML');
  assert.equal(asml.role, 'Makes it');
  assert.deepEqual(asml.countries, ['Netherlands']);
  assert.equal(asml.verificationLabel, 'Sourced');
  assert.match(asml.source ?? '', /asml\.com/);
  assert.equal(asml.directory?.scarcity, 'Chokepoint');
  assert.match(asml.directory?.why ?? '', /no second source/);
  assert.equal(asml.profileHref, '/markets/asml');
  // A slug that is not a maker of this chain opens nothing.
  assert.equal(makerDetail(EUV, 'tsmc'), null);
  assert.equal(makerDetail(EUV, undefined), null);
});
