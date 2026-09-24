/**
 * The drafter may propose; it may not put words on a page. These pin the
 * checks that stand between a model's reply and a reviewer's screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EVENTS, type CoverageEvent } from '../config/substrata-events';
import reviewed from '../config/substrata-events-accepted.json';
import { draftLead, firstJsonObject, pageWindow, readDraft, type Ask } from '../lib/event-draft';
import { BOTTLENECK_NAMES, eventIdFor, eventProblems, verbatimIn } from '../lib/event-rules';

const PAGE =
  'Home › News. July 17, 2026 — SK Siltron is proceeding with the liquidation of SK Siltron CSS, its SiC wafer manufacturing subsidiary located in Michigan. The process is expected to be completed by the end of this year. Readers’ comments follow.';
const LEAD = {
  id: 'abc',
  bottleneck: BOTTLENECK_NAMES[0],
  term: 'SiC wafer',
  url: 'https://example.org/news/1',
  title: 'SK Siltron liquidates CSS',
};
const TODAY = '2026-09-24';

function reply(overrides: Record<string, unknown> = {}) {
  return {
    verdict: 'event',
    reason: 'A dated liquidation of a wafer maker.',
    date: '2026-07-17',
    date_text: 'July 17, 2026',
    headline: 'SK Siltron is liquidating its US silicon carbide wafer subsidiary.',
    kind: 'capacity',
    effect: 'tightens',
    bottlenecks: [BOTTLENECK_NAMES[0], 'Unobtainium'],
    participants: ['Nobody Incorporated'],
    jurisdictions: ['us', 'KR', 'Korea'],
    quote:
      'SK Siltron is proceeding with the liquidation of SK Siltron CSS, its SiC wafer manufacturing subsidiary located in Michigan.',
    primary: false,
    ...overrides,
  };
}

test('a quote must occur on the page word for word; typography and spacing are forgiven', () => {
  assert.ok(verbatimIn('The process is expected to be completed by the end of this year.', PAGE));
  assert.ok(
    verbatimIn("Readers' comments   follow.", PAGE),
    'a straightened apostrophe is not a misquote',
  );
  assert.equal(
    verbatimIn("Readers' comments follow.", PAGE),
    'Readers’ comments follow.',
    'the stored quote is the page’s own characters',
  );
  assert.equal(verbatimIn('The process is expected to be finished by year end.', PAGE), null);
  assert.equal(
    verbatimIn('sk siltron is proceeding with the liquidation', PAGE),
    null,
    'case matters',
  );
  assert.equal(verbatimIn('Home', PAGE), null, 'too short to carry a claim');
});

test('a draft whose quote is not on the page is refused', () => {
  const out = readDraft(
    reply({ quote: 'SK Siltron will shut its Michigan wafer plant.' }),
    LEAD,
    PAGE,
    TODAY,
  );
  assert.equal(out.status, 'unusable');
});

test('a good reply becomes a draft with only names the site has', () => {
  const out = readDraft(reply(), LEAD, PAGE, TODAY);
  assert.equal(out.status, 'drafted');
  if (out.status !== 'drafted' || !out.draft) throw new Error('no draft');
  assert.deepEqual(out.draft.bottlenecks, [BOTTLENECK_NAMES[0]]);
  assert.deepEqual(out.draft.participants, []);
  assert.deepEqual(out.draft.jurisdictions, ['US', 'KR']);
  assert.equal(out.draft.source, LEAD.url);
  assert.equal(out.draft.date, '2026-07-17');
  assert.ok(out.notes.some((n) => n.includes('Unobtainium')));
  assert.ok(out.notes.some((n) => n.includes('Nobody Incorporated')));
  assert.ok(!out.notes.some((n) => n.startsWith('Date')), 'the date words are on the page');
  assert.deepEqual(eventProblems({ ...out.draft, acceptedOn: TODAY }, PAGE), []);
});

test('a date is never the crawl date: future dates are cleared, unmatched ones flagged', () => {
  const future = readDraft(reply({ date: '2027-01-01' }), LEAD, PAGE, TODAY);
  assert.ok(future.status === 'drafted' && future.draft?.date === '');
  const unmatched = readDraft(reply({ date: '2026-09-24', date_text: 'today' }), LEAD, PAGE, TODAY);
  assert.ok(unmatched.status === 'drafted' && unmatched.notes.some((n) => n.startsWith('Date')));
});

test('"not an event" carries a reason and no row', () => {
  const out = readDraft(
    { verdict: 'not_an_event', reason: 'A market forecast.' },
    LEAD,
    PAGE,
    TODAY,
  );
  assert.deepEqual(out, {
    status: 'drafted',
    suggestion: 'not_an_event',
    reason: 'A market forecast.',
    draft: null,
    notes: [],
  });
});

test('the drafter asks once more after a misquote, and stops at two calls', async () => {
  let calls = 0;
  const flaky: Ask = async () => {
    calls += 1;
    return calls === 1
      ? '```json\n' +
          JSON.stringify(reply({ quote: 'A sentence that is not there at all.' })) +
          '\n```'
      : `Sure: ${JSON.stringify(reply())}`;
  };
  const out = await draftLead(LEAD, PAGE, flaky, TODAY);
  assert.equal(out.status, 'drafted');
  assert.equal(calls, 2);

  calls = 0;
  const liar: Ask = async () => {
    calls += 1;
    return JSON.stringify(reply({ quote: 'Invented words, confidently stated.' }));
  };
  assert.equal((await draftLead(LEAD, PAGE, liar, TODAY)).status, 'unusable');
  assert.equal(calls, 2);
});

test('JSON is found inside fences and prose, braces in strings included', () => {
  assert.deepEqual(firstJsonObject('x {"a":"}{","b":{"c":1}} y'), { a: '}{', b: { c: 1 } });
  assert.equal(firstJsonObject('no json here'), null);
});

test('a long page is cut to its top and the passage the sweep matched', () => {
  const long = `${'intro '.repeat(1000)} the SiC wafer news ${'tail '.repeat(3000)}`;
  const window = pageWindow(long, 'SiC wafer');
  assert.ok(window.length < 5_200);
  assert.ok(window.includes('SiC wafer news'));
});

test('ids are the date and the first words of the headline', () => {
  assert.equal(
    eventIdFor('2026-07-17', 'SK Siltron is liquidating its US silicon carbide wafer subsidiary.'),
    '2026-07-17-sk-siltron-is-liquidating-its-us',
  );
});

test('rows accepted through review pass the same rules as the hand-written corpus', () => {
  for (const event of reviewed as CoverageEvent[]) {
    assert.deepEqual(eventProblems(event), [], event.id);
    assert.ok(
      EVENTS.includes(event) || EVENTS.some((e) => e.id === event.id),
      `${event.id} not in EVENTS`,
    );
  }
});
