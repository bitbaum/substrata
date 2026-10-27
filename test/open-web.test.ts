/**
 * The Ask reads the web (docs/architecture/2026-10-24-open-web-ask.md): the
 * router sends open-world questions to the web beside the corpus, pages are
 * read rather than snippets, a figure cited [W#] must be in its passage, and
 * no answer opens with what the corpus lacks. No network: every search and
 * every page here is a fake.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { routeQuestion, searchQueryFor } from '../lib/chat-agent/route';
import { passagesFor, printedDate } from '../lib/chat-web-passages';
import { lookUp, MAX_PAGES, type LookUpDeps } from '../lib/chat-web';
import { runPlan } from '../lib/chat-agent/lookups';
import { planLookups } from '../lib/chat-agent/plan';
import { readerContext } from '../lib/chat-context';
import { emptyLedger, type ToolEnv } from '../lib/chat-tools/ledger';
import { runTool } from '../lib/chat-tools/registry';
import { webFigureProblems, webPassagesIn } from '../lib/chat-agent/web-figures';
import { defaultDeny } from '../lib/chat-agent/default-deny';
import { answerFirst, opensWithCorpusGap } from '../lib/chat-agent/open-first';
import { webCitations } from '../lib/chat/web-citations';
import { runAgentToAnswer } from '../lib/chat-agent/run-to-answer';

const ON = { SEARXNG_URL: 'http://searx.test' } as unknown as NodeJS.ProcessEnv;

// --- routing -------------------------------------------------------------------

test('open-world questions search the web; questions about Substrata itself do not', () => {
  for (const q of [
    'What did Kazatomprom say about 2026 production guidance?',
    "Who are Kazatomprom's main competitors and how have their share prices moved this month?",
    'What is the latest news on the Cameco McArthur River production?',
    'Who are the largest rare earth producers outside China and what are they doing?',
    'Explain what a uranium conversion plant does',
    "What is Kazatomprom's share price today?",
    // When unsure, search: nothing open-world in it, and still the web.
    'Which countries mine gallium?',
  ])
    assert.equal(routeQuestion(q, '2026-10-24').web, true, q);
  for (const q of [
    "What is Substrata's methodology for evidence states?",
    'How well sourced is this record?',
    'Give me a recipe for banana bread',
  ])
    assert.equal(routeQuestion(q, '2026-10-24').web, false, q);
});

test('"this month", "today" and "latest" become dates the engine can rank by', () => {
  assert.match(
    searchQueryFor('How did uranium prices move this month?', '2026-10-24'),
    /October 2026/,
  );
  assert.match(
    searchQueryFor("What is Kazatomprom's share price today?", '2026-10-24'),
    /October 2026/,
  );
  assert.match(searchQueryFor('Latest news on Cameco McArthur River', '2026-10-24'), /2026/);
});

// --- reading pages ---------------------------------------------------------------

const PAGE = [
  'Skip to content. Subscribe to our newsletter. Cookies help us deliver our services.',
  'Markets | 21 Oct 2026.',
  'ASTANA, Oct 21 (Example) - Kazatomprom said on Tuesday it now expects 2026 production of 25,000 to 26,500 tU on a 100% basis, down from its earlier range.',
  'The company cited sulphuric acid shortages and delays at new wells.',
  'Analysts said the cut would support uranium prices.',
  'In other news, a football club won a match.',
].join(' ');

test('a page gives the passages that answer the question, verbatim, figures included', () => {
  const windows = passagesFor(PAGE, 'What did Kazatomprom say about 2026 production guidance?');
  assert.ok(windows.length >= 1);
  assert.ok(windows.join(' ').includes('25,000 to 26,500 tU on a 100% basis'), windows.join(' | '));
  assert.ok(!windows.join(' ').includes('Subscribe to our newsletter'));
  assert.ok(!windows.join(' ').includes('football'));
  assert.equal(printedDate(PAGE), '21 Oct 2026');
  assert.equal(printedDate('No date here at all.'), undefined);
});

test('the top four pages are read in parallel, each step said, the date kept', async () => {
  const results = [1, 2, 3, 4, 5, 6].map((i) => ({
    title: `Page ${i}`,
    url: `https://news${i}.example.org/a`,
    snippet: `Snippet ${i} about Kazatomprom guidance`,
    ...(i === 2 ? { published: '2026-10-22T09:00:00Z' } : {}),
  }));
  const read: string[] = [];
  const deps: LookUpDeps = {
    search: (async () => ({ status: 'found', query: 'q', results, attempts: [] })) as never,
    read: (async (url: string) => {
      read.push(url);
      return { ok: true, url, title: `T ${url}`, text: PAGE, truncated: false };
    }) as never,
  };
  const announced: string[] = [];
  const out = await lookUp('Kazatomprom 2026 production guidance', undefined, ON, deps, (u) =>
    announced.push(u),
  );
  assert.equal(MAX_PAGES, 4);
  assert.equal(read.length, 4, 'four pages read');
  assert.deepEqual(announced, read, 'each read is announced first');
  assert.equal(out.status, 'found');
  if (out.status !== 'found') return;
  assert.equal(out.findings.length, 6, 'the rest keep their snippets');
  assert.ok(out.findings[0].excerpt.includes('25,000 to 26,500 tU'));
  assert.equal(out.findings[1].published, '2026-10-22', "the engine's date first");
  assert.equal(out.findings[0].published, '21 Oct 2026', 'else the date the page prints');
  assert.equal(out.findings.filter((f) => f.unread).length, 2);
});

test('the web tool says "Reading <site>…" while it works and hands back dated passages', async () => {
  const steps: string[] = [];
  const env: ToolEnv = {
    ledger: emptyLedger(),
    step: (label) => steps.push(label),
    web: async (_q, _s, onRead) => {
      onRead?.('https://www.reuters.com/x');
      return {
        status: 'found',
        findings: [
          { title: 'R', url: 'https://www.reuters.com/x', excerpt: 'p', published: '2026-10-21' },
        ],
      };
    },
  };
  const data = JSON.parse((await runTool('web_search', { query: 'q' }, env)).result);
  assert.deepEqual(steps, ['Reading reuters.com…']);
  assert.equal(data.results[0].date, '2026-10-21');
  assert.equal(data.results[0].passage, 'p');
});

// --- routing in the run -----------------------------------------------------------

test('an open-world question searches the web beside the corpus, even when the corpus has rows', async () => {
  const q = 'What did Kazatomprom say about 2026 production guidance?';
  const context = readerContext({});
  const searched: string[] = [];
  const env: ToolEnv = {
    ledger: emptyLedger(),
    web: async (query) => {
      searched.push(query);
      return {
        status: 'found',
        findings: [{ title: 'K', url: 'https://k.example', excerpt: 'x' }],
      };
    },
  };
  const plan = planLookups(q, context, {});
  const route = routeQuestion(q, '2026-10-24');
  const looked = await runPlan(plan, q, context, env, () => {}, route);
  assert.equal(searched.length, 1);
  assert.equal(searched[0], route.query);
  assert.equal(looked.web, 'found');
  // A question about Substrata itself stays in the corpus.
  const own = "What is Substrata's methodology?";
  const ownRoute = routeQuestion(own);
  await runPlan(planLookups(own, context, {}), own, context, env, () => {}, ownRoute);
  assert.equal(searched.length, 1, 'no search for a question about Substrata itself');
});

// --- the web-figure guard -----------------------------------------------------------

const WEB_RESULT = `[web_search] ${JSON.stringify({
  status: 'found',
  results: [
    {
      cite_as: 'W1',
      title: 'Kazatomprom cuts 2026 guidance',
      url: 'https://k.example/a',
      date: '2026-10-21',
      passage: 'It now expects 2026 production of 25,000 to 26,500 tU on a 100% basis.',
    },
  ],
})}`;

test('a figure cited to a page must be on that page', () => {
  const passages = webPassagesIn([WEB_RESULT]);
  assert.equal(passages.size, 1);
  assert.deepEqual(
    webFigureProblems('Kazatomprom expects 25,000 to 26,500 tU for 2026 [W1].', passages),
    [],
  );
  assert.deepEqual(webFigureProblems('Kazatomprom expects 27,500 tU for 2026 [W1].', passages), [
    '27500',
  ]);
  // Default deny keeps the backed sentence and drops the other.
  const out = defaultDeny(
    [
      'Kazatomprom now expects 25,000 to 26,500 tU in 2026 (100% basis), according to [W1].',
      'Analysts expect 27,500 tU [W1].',
    ].join('\n'),
    {
      question: 'q',
      summary: [],
      webCount: 1,
      evidence: WEB_RESULT,
      web: passages,
    },
  );
  assert.match(out.answer, /25,000 to 26,500 tU/);
  assert.doesNotMatch(out.answer, /27,500/);
});

// --- the answer first -------------------------------------------------------------

test('an answer never opens with what the corpus does not track', () => {
  const answer = [
    'The Substrata corpus does not track Kazatomprom’s guidance.',
    '',
    '### Unchecked web results',
    'Kazatomprom now expects 25,000 to 26,500 tU in 2026, according to [W1].',
  ].join('\n');
  assert.ok(opensWithCorpusGap(answer));
  const out = answerFirst(answer);
  assert.ok(!opensWithCorpusGap(out), out);
  assert.ok(out.startsWith('Kazatomprom now expects'), out);
  assert.ok(out.endsWith('The Substrata corpus does not track Kazatomprom’s guidance.'), out);
  assert.doesNotMatch(out, /Unchecked web results/);
  for (const opening of [
    'Substrata does not record real-time equity market movements.',
    'Our database does not hold share prices.',
    'This is not tracked in the corpus.',
  ])
    assert.ok(opensWithCorpusGap(opening), opening);
  assert.ok(!opensWithCorpusGap('Kazatomprom cut its guidance on 21 October [W1].'));
});

test('a whole run: the reader gets the answer first, with the figure the page printed', async () => {
  const data = await runAgentToAnswer({
    question: 'What did Kazatomprom say about 2026 production guidance?',
    history: [],
    context: readerContext({}),
    today: '2026-10-24',
    env: {
      web: async (_q, _s, onRead) => {
        onRead?.('https://k.example/a');
        return {
          status: 'found',
          findings: [
            {
              title: 'Kazatomprom cuts 2026 guidance',
              url: 'https://k.example/a',
              excerpt: 'It now expects 2026 production of 25,000 to 26,500 tU on a 100% basis.',
              published: '2026-10-21',
            },
          ],
        };
      },
    },
    fileGap: () => {},
    turn: async () => ({
      text: 'The Substrata corpus does not track Kazatomprom’s forward-looking guidance. Kazatomprom now expects 2026 production of 25,000 to 26,500 tU on a 100% basis, according to a page dated 2026-10-21 [W1].',
      calls: [],
      model: 'm',
    }),
  });
  assert.ok(data.answer.startsWith('Kazatomprom now expects'), data.answer);
  assert.match(data.answer, /25,000 to 26,500 tU/);
  assert.equal(data.web.length, 1);
  assert.ok(
    data.trail.some((t) => /Searching the web/.test(t)),
    data.trail.join(' | '),
  );
  assert.ok(data.trail.includes('Reading k.example…'), data.trail.join(' | '));
});

// --- on screen -----------------------------------------------------------------------

test('a cited web page is a chip linked to the page, named by its site and date', () => {
  const { content, citations } = webCitations('Guidance was cut [W1]. Prices rose [W1, W2].', [
    { title: 'A', url: 'https://www.reuters.com/a', published: '2026-10-21' },
    { title: 'B', url: 'https://example.org/b' },
  ]);
  assert.equal(content, 'Guidance was cut [D1]. Prices rose [D1, D2].');
  assert.equal(citations?.D1.label, 'reuters.com');
  assert.equal(citations?.D1.href, 'https://www.reuters.com/a');
  assert.match(citations!.D1.detail, /dated 2026-10-21 · web page, not checked by Substrata/);
  assert.match(citations!.D2.detail, /undated/);
  assert.ok(!/\[F\d/.test(content), 'never a corpus handle');
  // An answer citing no page, or a page not read, is left alone / loses the handle.
  assert.deepEqual(webCitations('No pages.', []), { content: 'No pages.' });
  assert.equal(
    webCitations('Odd [W9].', [{ title: 'A', url: 'https://a.example' }]).content,
    'Odd .',
  );
});

// --- PDFs ----------------------------------------------------------------------------

test('a PDF is read as its text, through readPage and its address check', async () => {
  const { readFileSync } = await import('node:fs');
  const { readPage } = await import('@bitbaum/ai-kit/web');
  const { pdfAwareFetch } = await import('../lib/chat-web-pdf');
  const bytes = readFileSync(
    new URL('./fixtures/sources/kazatomprom-2q26-trading-update-p6.pdf', import.meta.url),
  );
  const fake: typeof fetch = async () =>
    new Response(bytes, { status: 200, headers: { 'content-type': 'application/pdf' } });
  const page = await readPage(
    'https://www.kazatomprom.kz/storage/x.pdf',
    { maxChars: 40_000 },
    { fetch: pdfAwareFetch(fake), lookup: async () => [{ address: '93.184.216.34' }] },
  );
  assert.ok(page.ok, JSON.stringify(page));
  if (page.ok) assert.match(page.text, /Kazatomprom|uranium|production/i);
  // A private address is still refused before anything is fetched.
  const blocked = await readPage(
    'https://internal.example/x.pdf',
    {},
    { fetch: pdfAwareFetch(fake), lookup: async () => [{ address: '10.0.0.5' }] },
  );
  assert.equal(blocked.ok, false);
  // Over the byte cap: refused, not read.
  const big = await readPage(
    'https://www.kazatomprom.kz/storage/x.pdf',
    {},
    { fetch: pdfAwareFetch(fake, 100), lookup: async () => [{ address: '93.184.216.34' }] },
  );
  assert.equal(big.ok, false);
});

test('a [W#] stays only on a sentence its page supports: no chip on the model’s own analysis', async () => {
  const { webCiteSupported, withoutUnsupportedWebCites } =
    await import('../lib/chat-agent/web-figures');
  const { finishInCode } = await import('../lib/chat-agent/check-answer');
  // Seen live: a stock-quote page cited for the opening's generic analysis.
  const quote =
    '[web_search] ' +
    JSON.stringify({
      results: [
        {
          cite_as: 'W1',
          title: 'CoreWeave, Inc. (CRWV) Stock Price — Yahoo Finance',
          passage: 'CoreWeave shares closed at 92.40, down 31% in October.',
          url: 'https://finance.yahoo.com/quote/CRWV',
        },
      ],
    });
  const web = webPassagesIn([quote]);
  const analysis = 'The sector looks stretched and lenders will grow cautious [W1].';
  const figure = 'CoreWeave shares fell 31% in October [W1].';
  const named = 'CoreWeave is the listed neocloud the post leans on [W1].';
  assert.equal(webCiteSupported(analysis, web), false, 'nothing of it is on the page');
  assert.equal(webCiteSupported(figure, web), true, 'the page prints the figure');
  assert.equal(webCiteSupported(named, web), true, 'the page names it');
  assert.equal(
    withoutUnsupportedWebCites(`${analysis} ${figure}`, web),
    `The sector looks stretched and lenders will grow cautious. ${figure}`,
  );
  const out = finishInCode(`${analysis} ${figure}`, {
    facts: null,
    gaps: [],
    webCount: 1,
    question: 'What is your take on this post?',
    results: [quote],
  });
  assert.doesNotMatch(out, /cautious \[W1\]/, 'no chip on the analysis');
  assert.match(out, /31% in October \[W1\]/, 'the supported sentence keeps its chip');
});
