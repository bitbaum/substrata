/**
 * The front page's failures, pinned: rows that differ from their siblings, an
 * empty state on the first screen, a second Ask, a number that is not counted.
 * Layout itself is checked in a browser (scripts/ux/home-layout.mjs); these
 * are the parts that can be decided from the source and the data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { QUESTION_LENGTH } from '../config/substrata-chat';
import { askHref, startQuestion } from '../lib/home-asks';
import { homeAsks, starters } from '../lib/starters';
import { whatChangedRows, type HomeFeed } from '../lib/home-feed';
import { worstNow } from '../lib/worst-now';
import { WorstNow } from '../app/_home/WorstNow';
import type { DeskItem } from '../lib/desk';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const homeSources = [
  'app/page.tsx',
  ...readdirSync(new URL('app/_home/', root)).map((f) => `app/_home/${f}`),
].map((f) => ({ f, text: read(f) }));

test('the front page composes no empty state', () => {
  for (const { f, text } of homeSources) {
    assert.ok(!/\bEmpty\b/.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${f} uses Empty`);
    assert.ok(!/Nothing checked and filed/.test(text), `${f} prints an empty-state sentence`);
  }
});

const item = (source: 'event' | 'lead', id: string): DeskItem =>
  ({
    source,
    id,
    at: '2026-10-01T12:00:00.000Z',
    title: id,
    url: `https://x/${id}`,
    host: 'x',
    bottlenecks: [],
    effect: 'neutral',
    ...(source === 'event' ? { dateOnly: true } : { alsoAt: [] }),
  }) as DeskItem;

test('what changed: checked first, else the unchecked finds, else nothing', () => {
  const checked = [1, 2, 3, 4].map((n) => item('event', `e${n}`));
  const found = [1, 2].map((n) => item('lead', `l${n}`));
  const a = whatChangedRows({ checked, found });
  assert.equal(a?.kind, 'checked');
  assert.equal(a?.items.length, 3);
  const b = whatChangedRows({ checked: [], found });
  assert.equal(b?.kind, 'found');
  assert.equal(b?.items.length, 2);
  assert.equal(
    whatChangedRows({ checked: [], found: [] } as Pick<HomeFeed, 'checked' | 'found'>),
    null,
  );
});

test('every worst-right-now row is drawn by the one row component', () => {
  const board = worstNow(3);
  const html = renderToStaticMarkup(React.createElement(WorstNow, { ...board, bindingNow: 17 }));
  assert.equal((html.match(/class="board-row"/g) ?? []).length, board.worst.length);
  // The same four cells in each: name, meter, sentence, status — no per-row switches.
  for (const cell of ['name', 'meter', 'plain', 'status'])
    assert.equal(
      (html.match(new RegExp(`board-row-${cell}`, 'g')) ?? []).length,
      board.worst.length,
      cell,
    );
  const board_ = read('app/_home/WorstNow.tsx');
  assert.ok(!board_.includes('<li'), 'rows are not hand-written in the section');
});

test('the Ask box is the only Ask the front page draws', () => {
  const dock = read('components/portal/AskDock.tsx');
  assert.ok(
    dock.includes("path === '/'") || dock.includes('onHome'),
    'the floating Ask is not drawn on /',
  );
  const top = read('components/shell/TopBar.tsx');
  assert.ok(top.includes('HOME_LINK.href'), "the phone's top-bar Ask is not drawn on /");
});

test('the front page is served from a cache and never reads the session', () => {
  const page = read('app/page.tsx');
  assert.match(page, /export const revalidate = 60;/);
  assert.ok(!/force-dynamic/.test(page));
  assert.match(page, /export const dynamic = 'force-static';/);
  assert.ok(!/currentSession|cookies\(|headers\(/.test(page));
  assert.ok(page.includes('reader="client"'));
});

test('home questions: four from the corpus, no two of one kind, all sendable', () => {
  const asks = homeAsks('2026-10-23');
  assert.equal(asks.length, 4);
  assert.deepEqual(
    asks.map((a) => a.question),
    starters({ seed: '2026-10-23', count: 4 }).map((s) => s.question),
  );
  for (const a of asks) {
    assert.ok(a.question.length >= QUESTION_LENGTH.min && a.question.length <= QUESTION_LENGTH.max);
    assert.equal(
      startQuestion(new URL(askHref(a.question), 'http://x').searchParams.get('q') ?? ''),
      a.question,
    );
  }
  // Another day, another four — the page is served from a cache keyed by the date.
  assert.notDeepEqual(homeAsks('2026-10-24'), asks);
  const page = read('app/page.tsx');
  assert.match(page, /homeAsks\(seedFor\(now\)\)/, 'the page seeds its questions with today');
});

test('a question parameter is trimmed, bounded and ignored when it is not a question', () => {
  assert.equal(startQuestion(undefined), '');
  assert.equal(startQuestion(['a', 'b']), '');
  assert.equal(startQuestion(' x '), '');
  assert.equal(startQuestion('  Who makes wafers? '), 'Who makes wafers?');
  assert.equal(startQuestion('a'.repeat(9000)).length, QUESTION_LENGTH.max);
});
