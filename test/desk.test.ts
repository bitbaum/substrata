/**
 * The desk feed: one list, two kinds of row, never confused.
 *
 * Every title here is one the scheduled sweep actually filed on the box, so
 * the noise rules are measured against observed noise, not an imagined shape.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { CoverageEvent } from '../config/substrata-events';
import {
  buildFeed,
  cleanTitle,
  headlineNamesRail,
  isStory,
  whenLabel,
  type Lead,
} from '../lib/desk';

const NOW = new Date('2026-09-24T09:00:00.000Z');

function lead(over: Partial<Lead>): Lead {
  return {
    id: over.url ?? 'x',
    bottleneck: 'Large power transformer slots',
    url: 'https://example.com/a',
    title: 'Hitachi deepens commitment to U.S. manufacturing with $528 million transformer factory',
    published: null,
    foundAt: '2026-09-23T20:00:00.000Z',
    effectGuess: 'loosens',
    ...over,
  };
}

const EVENT: CoverageEvent = {
  id: '2026-08-27-tokuyama',
  date: '2026-08-27',
  headline: 'Tokuyama opens a polysilicon factory in Vietnam.',
  kind: 'capacity',
  effect: 'loosens',
  bottlenecks: ['Electronic-grade polysilicon'],
  participants: ['Tokuyama'],
  jurisdictions: ['VN'],
  source: 'https://www.pv-magazine-india.com/tokuyama',
  primary: true,
  quote: 'Tokuyama opens polysilicon factory in Vietnam.',
  acceptedOn: '2026-09-15',
};

test('pages that are not stories stay off the desk', () => {
  for (const title of [
    'Homepage | Bureau of Industry and Security',
    'Grids & Benefits - Neon',
    'Immersion Cooling Market worth $5.78 billion by 2033 - Exclusive Report by MarketsandMarkets',
    'China Semiconductor Device Market (2026-2031) - Growth Driven by Rising Electric Vehicle',
    'Leading Edge Semi Shortages + Stock Picks - by Tech Fund',
    "Applied Materials, Inc. (AMAT) Down 5.3% — Should I Secure What's Left? - Weiss Ratings",
    'China Rare Earth Export Controls: Essential Buyer Guide',
    '[2608.29359] Minimizing Grid Interconnection Capacity Requirements for AI Data Centers',
    'Tin - Price - Chart - Historical Data - News',
    'CVD Diamond Materials News and Press Releases | Media - Great Lakes Crystal Technologies',
  ]) {
    assert.equal(isStory(title), false, `should be dropped: ${title}`);
  }
  for (const title of [
    'Shanghai Electric Secures First Overseas Heavy-Duty Gas Turbine Order for 500 MW Malaysian Project',
    'China rare earth export pause nears expiry',
    'Transformer Lead Times Hit 128 Weeks: What It Means',
    'Samsung bets on Texas expansion as memory shortage stretches into 2028 - The Korea Herald',
  ]) {
    assert.equal(isStory(title), true, `should survive: ${title}`);
  }
});

test('a title reads as a headline: entities decoded, site name dropped', () => {
  assert.equal(
    cleanTitle('KLA Launches $11 Billion Buyback Cycle: Here&#8217;s What to Expect | TIKR.com'),
    'KLA Launches $11 Billion Buyback Cycle: Here’s What to Expect',
  );
  assert.equal(
    cleanTitle(
      'Samsung bets on Texas expansion as memory shortage stretches into 2028 - The Korea Herald',
    ),
    'Samsung bets on Texas expansion as memory shortage stretches into 2028',
  );
  // Too short to lose its tail: what is left would not be a headline.
  assert.equal(
    cleanTitle('Restructuring U.S. | The Quartz Corp'),
    'Restructuring U.S. | The Quartz Corp',
  );
});

test('the same press release on four wires is one row, not four', () => {
  const title =
    'Shanghai Electric Secures First Overseas Heavy-Duty Gas Turbine Order for 500 MW Malaysian Project';
  const feed = buildFeed(
    [],
    [
      lead({ url: 'https://www.prnewswire.com/a', title }),
      lead({ url: 'https://www.finanznachrichten.de/b', title }),
      lead({ url: 'https://www.eqs-news.com/c', title: `${title} | Corporate` }),
    ],
    NOW,
  );
  assert.equal(feed.length, 1);
  const row = feed[0];
  assert.equal(row.source, 'lead');
  if (row.source === 'lead') assert.deepEqual(row.alsoAt, ['finanznachrichten.de', 'eqs-news.com']);
});

test('events and leads merge newest first, and a filed lead is not shown twice', () => {
  const feed = buildFeed(
    [EVENT],
    [
      lead({ url: 'https://a.example/new', foundAt: '2026-09-24T08:00:00.000Z' }),
      lead({
        url: EVENT.source,
        title: 'Japan’s Tokuyama opens polysilicon factory in Vietnam today',
      }),
    ],
    NOW,
  );
  assert.deepEqual(
    feed.map((item) => item.source),
    ['lead', 'event'],
  );
});

test('a lead the publisher dated long ago is not news, whenever it was found', () => {
  const feed = buildFeed(
    [],
    [lead({ published: '2024-09-20T00:00:00', foundAt: '2026-09-22T10:00:00.000Z' })],
    NOW,
  );
  assert.equal(feed.length, 0);
});

test('time labels read like a feed', () => {
  assert.equal(whenLabel('2026-09-24T08:59:30.000Z', NOW), 'just now');
  assert.equal(whenLabel('2026-09-24T06:00:00.000Z', NOW), '3h ago');
  assert.equal(whenLabel('2026-09-10T06:00:00.000Z', NOW), '10 Sep');
  assert.equal(whenLabel('2025-12-03T12:00:00.000Z', NOW, true), '3 Dec 2025');
  assert.equal(whenLabel('2026-09-23T12:00:00.000Z', NOW, true), 'yesterday');
});

test('the desk labels every lead as unread and sweeps only after responding', () => {
  // A lead on the desk is a page nobody has read. If the label went, the desk
  // would be publishing unread rows as findings — the one thing the site says
  // it never does.
  const page = readFileSync(new URL('../app/account/page.tsx', import.meta.url), 'utf8');
  const row = readFileSync(new URL('../components/desk/FeedItem.tsx', import.meta.url), 'utf8');
  assert.ok(row.includes('not yet reviewed'), 'every lead must say nobody has read it');
  assert.ok(page.includes('after('), 'a desk visit must not wait on the web to paint');
  const store = readFileSync(new URL('../lib/sweep-store.ts', import.meta.url), 'utf8');
  assert.ok(
    /last_swept < now\(\) - \(\$2::float8 \* interval/.test(store),
    'an on-demand sweep must be bounded by a per-node cooldown, not by visits',
  );
});

import { type DeskItem } from '../lib/desk';
import { applyFilter, railActivity, type FeedFilter } from '../lib/desk-filter';
import { parseSweepSettings, queryFor } from '../lib/sweep';

const BASE: FeedFilter = {
  view: 'all',
  days: null,
  showVerified: true,
  showLeads: true,
  showFilings: true,
  effect: null,
  bottlenecks: [],
  q: '',
  mutedHosts: [],
  mutedWords: [],
  readUntil: null,
};
const NONE = { read: new Set<string>(), saved: new Set<string>(), hidden: new Set<string>() };

function feedOf(): DeskItem[] {
  return buildFeed(
    [EVENT],
    [
      lead({
        id: 'a',
        url: 'https://finance.yahoo.com/a',
        title: 'Gas turbine backlog grows again at GE Vernova plants',
      }),
      lead({ id: 'b', url: 'https://hitachienergy.com/b', foundAt: '2026-09-24T07:00:00.000Z' }),
    ],
    NOW,
  );
}

test('hidden rows vanish from every view but Hidden, so hiding is undoable', () => {
  const feed = feedOf();
  const hidden = { ...NONE, hidden: new Set(['lead:b']) };
  assert.ok(!applyFilter(feed, BASE, hidden, NOW).some((i) => i.id === 'b'));
  assert.deepEqual(
    applyFilter(feed, { ...BASE, view: 'hidden' }, hidden, NOW).map((i) => i.id),
    ['b'],
  );
});

test('unread respects both per-row marks and the mark-all-read watermark', () => {
  const feed = feedOf();
  const unread = (readUntil: string | null, read: string[] = []) =>
    applyFilter(
      feed,
      { ...BASE, view: 'unread', readUntil },
      { ...NONE, read: new Set(read) },
      NOW,
    ).map((i) => i.id);
  assert.equal(unread(null).length, 3);
  assert.deepEqual(unread('2026-09-23T23:00:00.000Z'), ['b']);
  assert.deepEqual(unread(null, ['lead:b', 'event:2026-08-27-tokuyama']), ['a']);
});

test('muted sites and words, effect and rail filters each narrow the feed', () => {
  const feed = feedOf();
  const ids = (f: Partial<FeedFilter>) =>
    applyFilter(feed, { ...BASE, ...f }, NONE, NOW).map((i) => i.id);
  assert.ok(!ids({ mutedHosts: ['yahoo.com'] }).includes('a'), 'a parent domain mutes subdomains');
  assert.ok(!ids({ mutedWords: ['BACKLOG'] }).includes('a'), 'muted words ignore case');
  assert.deepEqual(
    ids({ effect: 'loosens' }),
    ['2026-08-27-tokuyama'],
    'effect is a verified-only filter',
  );
  assert.deepEqual(ids({ bottlenecks: ['Electronic-grade polysilicon'] }), ['2026-08-27-tokuyama']);
  assert.deepEqual(ids({ showLeads: false }), ['2026-08-27-tokuyama']);
});

test('rail activity counts rows per rail, busiest first', () => {
  const activity = railActivity(feedOf());
  assert.equal(activity[0].name, 'Large power transformer slots');
  assert.equal(activity[0].count, 2);
});

test('sweep settings from the database are clamped, and the query year is not a literal', () => {
  const s = parseSweepSettings({
    everyHours: 0,
    nodesPerRun: 50,
    eventWords: ['a', 'shortage', 'x) OR (y'],
  });
  assert.equal(s.everyHours, 1);
  assert.equal(s.nodesPerRun, 8);
  assert.deepEqual(s.eventWords, ['shortage'], 'too-short and query-breaking words are dropped');
  assert.equal(
    queryFor('neon', ['lead time', 'export'], 2027),
    '"neon" ("lead time" OR export) 2027',
  );
  const source = readFileSync(new URL('../lib/sweep.ts', import.meta.url), 'utf8');
  assert.ok(!/\) 20\d\d`/.test(source), 'the search year must come from the clock');
});

test('a headline must name its rail as a whole word, not a fragment', () => {
  const rail = { bottleneck: 'Precision reduction drives', term: 'precision reduction drive' };
  assert.equal(
    headlineNamesRail({ ...rail, title: 'CDL Electronic Logs: Commercial Driver Electronic Logs' }),
    false,
    '"driver" is not "drive"',
  );
  assert.equal(
    headlineNamesRail({ ...rail, title: 'Nabtesco to build new reducer and drive plant' }),
    true,
  );
  assert.equal(
    headlineNamesRail({
      bottleneck: 'Large power transformer slots',
      term: 'large power transformer',
      title: 'Transformer Lead Times Hit 128 Weeks',
    }),
    true,
  );
});
