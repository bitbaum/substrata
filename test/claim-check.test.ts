/**
 * Claim check (lib/chat-agent/claim-check.ts): a screenshot or a pasted post,
 * read, its claims checked, a take written in a fixed shape — and the pure
 * pieces under it: the reading's validator, the planner, picture validation,
 * the blind-model sentence. Whole runs use a recorded FIXTURE
 * (test/fixtures/screenshot-neocloud.json): a fake vision model (image text
 * in, claims out) and a fake web. Asserted: the shape — bottom line first,
 * one status per claim, no unverified claim stated as fact. Never the prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NoVisionLinkError } from '@bitbaum/ai-kit';

import rows from './ask-evals.json';
import { BLIND_MESSAGE, runClaimCheck } from '../lib/chat-agent/claim-check';
import { claimPlan, claimQuery } from '../lib/chat-agent/claim-plan';
import {
  claimLines,
  shapeClaimAnswer,
  withoutMaterialFigures,
} from '../lib/chat-agent/claim-shape';
import { bringsMaterial, parseReading } from '../lib/chat-agent/read-claims';
import type { AgentAnswer, AgentEvent } from '../lib/chat-agent/answer';
import type { ModelTurn } from '../lib/chat-agent/turn';
import { readerContext } from '../lib/chat-context';
import { fromWire, readAttachedText, readImage, readImages, MAX_IMAGES } from '../lib/chat/image';
import type { WebFinding } from '../lib/chat-web';

interface Fixture {
  question: string;
  postText: string;
  reading: { text: string; claims: { claim: string; who?: string }[] };
  web: { match: string; findings: WebFinding[] }[];
  answer: string;
  expect: { statuses: Record<string, string>; dropped: string[]; leadStarts: string };
}

const PNG = `data:image/png;base64,${Buffer.from('fake png bytes').toString('base64')}`;
const TODAY = '2026-10-27';

// ---------------------------------------------------------------- pictures

test('a picture is a strict base64 data URL of an accepted type, under the cap', () => {
  assert.equal(readImage(PNG).ok, true);
  assert.equal(readImage('data:text/html;base64,PGgxPg==').ok, false);
  assert.equal(readImage('https://example.com/a.png').ok, false);
  assert.equal(readImage(`data:image/png;base64,${'A'.repeat(2_100_000)}`).ok, false);
  assert.deepEqual(readImages(undefined), { ok: true, images: [] });
  const many = readImages(Array(MAX_IMAGES + 1).fill(PNG));
  assert.equal(many.ok, false);
  const bad = readImages([PNG, 'data:image/svg+xml;base64,PHN2Zz4=']);
  assert.ok(!bad.ok && /PNG, JPEG, WebP or GIF/.test(bad.error));
  assert.equal(readAttachedText('a\u0000b'), 'ab');
});

test('the composer’s attachments become pictures, attached text and names', () => {
  const out = fromWire([
    { kind: 'image', name: 'post.png', mimeType: 'image/png', dataBase64: 'AAAA' },
    { kind: 'text', name: 'notes.txt', content: 'hello' },
  ]);
  assert.deepEqual(out.images, ['data:image/png;base64,AAAA']);
  assert.equal(out.attached, '--- notes.txt ---\nhello');
  assert.deepEqual(out.names, ['post.png', 'notes.txt']);
});

test('material is pictures, attached text, or a long paste with figures — not a long question', () => {
  assert.ok(bringsMaterial({ question: 'x?', images: [PNG] }));
  assert.ok(bringsMaterial({ question: 'x?', attached: 'post' }));
  const fixture = load();
  assert.ok(bringsMaterial({ question: `${fixture.postText}\n\nwhat's your take?` }));
  assert.ok(!bringsMaterial({ question: 'why '.repeat(100) }));
});

// ---------------------------------------------------------------- the reading

test('a reading keeps claims whose numbers the material printed, and drops the rest', () => {
  const f = load();
  const reading = parseReading(`Here you go:\n${JSON.stringify(f.reading)}`);
  assert.ok(reading);
  assert.deepEqual(
    reading.claims.map((c) => c.id),
    ['C1', 'C2', 'C3', 'C4'],
  );
  assert.ok(!reading.claims.some((c) => c.text.includes('5 million')), 'an invented figure goes');
  assert.equal(reading.claims[0].who, 'Elon Musk');
  assert.equal(reading.claims[2].kind, 'market');
  assert.equal(reading.claims[3].kind, 'quote');
  assert.equal(parseReading('no json here'), null);
  assert.equal(parseReading('{"text":"","claims":[]}'), null);
  const dupes = parseReading(
    JSON.stringify({
      text: 'a 10% rise',
      claims: Array(9).fill({ claim: 'Prices rose 10% today' }),
    }),
  );
  assert.equal(dupes?.claims.length, 1, 'deduplicated');
});

test('each claim gets a search aimed at it; listed companies get the market tools', () => {
  const claims = parseReading(
    JSON.stringify({
      text: 'NVIDIA shares are down 12% this month. Gartner sees a $4.9T gap.',
      claims: [
        { claim: 'NVIDIA shares are down 12% this month' },
        { claim: 'a $4.9T gap between AI spending and revenue', who: 'Gartner' },
      ],
    }),
  )!.claims;
  const plan = claimPlan(claims, "what's your take?", TODAY);
  assert.deepEqual(
    plan.subQuestions.map((s) => s.id),
    ['C1', 'C2'],
  );
  assert.match(plan.subQuestions[1].query, /^Gartner /, 'the attribution leads the query');
  assert.match(plan.subQuestions[0].query, /2026$/, 'an undated claim is searched this year');
  const price = plan.calls.find((c) => c.name === 'price_history');
  assert.ok(price, plan.calls.map((c) => c.name).join(','));
  assert.equal(JSON.parse(price.args).range, '1M', '"this month" in the claim → one month');
  assert.match(claimQuery(claims[1], TODAY), /4\.9T/);
});

// ---------------------------------------------------------------- the shape

test('a status stands only with a citation; a missing claim is added; material figures go', () => {
  const f = load();
  const reading = parseReading(JSON.stringify(f.reading))!;
  const shaped = shapeClaimAnswer(f.answer, reading, { webCount: 2, from: 'screenshot' });
  const section = shaped.slice(shaped.indexOf('### Claim by claim'));
  const lines = section.split('\n').filter((l) => l.startsWith('- **'));
  assert.equal(lines.length, 4, 'one line per claim');
  assert.match(lines[0], /^- \*\*Not found\*\* — Elon Musk, per the screenshot: “200\+ AI/);
  assert.match(lines[1], /^- \*\*Not found\*\* — the screenshot: “SpaceX closed \$40B/);
  assert.match(lines[2], /^- \*\*Partly\*\* — .*\[W1\]/);
  assert.match(lines[3], /^- \*\*Confirmed\*\* — .*\[W2\]/);
  assert.doesNotMatch(shaped, /makes a collapse obvious/);
  assert.match(shaped, /### Sources\n\n\[W1\] \[W2\]$/);
  assert.equal(claimLines('- **C2 · partly** — x [W1]').get('C2')?.status, 'Partly');
  assert.equal(
    withoutMaterialFigures('CoreWeave fell 38%. It is volatile.', reading),
    'It is volatile.',
  );
});

// ---------------------------------------------------------------- whole runs

function load(path = 'test/fixtures/screenshot-neocloud.json'): Fixture {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')) as Fixture;
}

/** A fake model: the fixture's reading on the read call (with the picture checked), its answer on the write. */
function fakeTurn(f: Fixture, calls: string[], blind = false): ModelTurn {
  return async ({ messages, onText }) => {
    const system = String(messages[0].content);
    if (/You read material/.test(system)) {
      calls.push('read');
      if (blind) throw new NoVisionLinkError(['groq/a-text-model']);
      return { text: JSON.stringify(f.reading), calls: [], model: 'fake-vision' };
    }
    calls.push('write');
    assert.match(system, /THEIR MATERIAL/, 'the writer is told the material is not a source');
    onText(f.answer);
    return { text: f.answer, calls: [], model: 'fake' };
  };
}

async function run(f: Fixture, how: 'image' | 'paste', blind = false) {
  const events: AgentEvent[] = [];
  const calls: string[] = [];
  const searched: string[] = [];
  await runClaimCheck({
    question: how === 'paste' ? `${f.postText}\n\n${f.question}` : f.question,
    images: how === 'image' ? [PNG] : [],
    attached: '',
    history: [],
    context: readerContext({}),
    today: TODAY,
    turn: fakeTurn(f, calls, blind),
    fileGap: () => {},
    emit: (e) => events.push(e),
    env: {
      web: async (q, _s, onRead) => {
        searched.push(q);
        const hit = f.web.find((w) => q.toLowerCase().includes(w.match));
        if (!hit) return { status: 'nothing' };
        for (const x of hit.findings) onRead?.(x.url);
        return { status: 'found', findings: hit.findings };
      },
    },
  });
  return { events, calls, searched };
}

const SCREENSHOT_ROWS = (rows as { id: string; screenshot?: string; material?: string }[]).filter(
  (r) => r.screenshot,
);

test('the eval set carries the screenshot rows', () => {
  assert.deepEqual(
    SCREENSHOT_ROWS.map((r) => r.material),
    ['image', 'paste'],
  );
});

for (const row of SCREENSHOT_ROWS)
  test(`claim check ${row.id}: bottom line first, a status per claim, nothing unverified as fact`, async () => {
    const f = load(row.screenshot);
    const { events, calls, searched } = await run(f, row.material as 'image' | 'paste');
    const done = events.find((e) => e.type === 'done');
    assert.ok(
      done && done.type === 'done',
      JSON.stringify(events.filter((e) => e.type === 'error')),
    );
    const data: AgentAnswer = done.data;
    const status = events
      .filter((e) => e.type === 'status')
      .map((e) => (e as { text: string }).text);
    assert.equal(
      status[0],
      row.material === 'image' ? 'Reading your screenshot…' : 'Reading your pasted post…',
    );
    assert.ok(
      data.trail.some((t) => t.startsWith('Checking: CoreWeave shares')),
      data.trail.join(' | '),
    );
    // One read, one write — and at most one revision, when a guard sends the draft back.
    assert.equal(calls[0], 'read');
    assert.ok(calls.length >= 2 && calls.length <= 3, calls.join(','));
    assert.equal(searched.length, 4, 'one search per claim');
    const a = data.answer;
    assert.ok(a.startsWith(f.expect.leadStarts), a.slice(0, 120));
    const lines = a
      .split('\n')
      .filter((l) => /^- \*\*(Confirmed|Partly|Contradicted|Not found)\*\*/.test(l));
    assert.deepEqual(
      lines.map((l) => /\*\*(.+?)\*\*/.exec(l)![1]),
      Object.values(f.expect.statuses),
    );
    for (const gone of f.expect.dropped) assert.ok(!a.includes(gone), `drops "${gone}"`);
    // Every material figure outside a "Not found" line sits in a cited sentence.
    for (const line of a.split('\n').filter((l) => !l.includes('**Not found**')))
      if (/\$40B|38%/.test(line)) assert.match(line, /\[W\d\]/, line);
    assert.match(a, /Reasoning, not a sourced forecast:/);
    assert.match(data.material ?? '', /^\[The reader's (screenshot|pasted post), as read/);
  });

test('no model that reads pictures: one honest sentence, and nothing is guessed', async () => {
  const f = load();
  const { events, calls } = await run(f, 'image', true);
  assert.deepEqual(calls, ['read']);
  const error = events.find((e) => e.type === 'error');
  assert.ok(error && error.type === 'error');
  assert.equal(error.kind, 'blind');
  assert.equal(error.error, BLIND_MESSAGE);
  assert.match(BLIND_MESSAGE, /Paste the text/);
  assert.match(BLIND_MESSAGE, /your own AI key/);
  assert.ok(!events.some((e) => e.type === 'done'), 'no answer about a picture nobody read');
});
