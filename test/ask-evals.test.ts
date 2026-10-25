/**
 * Ask evals, without a model or a database: each row of `ask-evals.json` is a
 * question a hedge fund, a journalist or a think tank would ask, with what a
 * correct answer must rest on. This file checks the two things that can be
 * checked in process — what the planner looks up before the model is called,
 * and what the in-process retriever (`lib/index/retrieve.ts`) brings back —
 * so a failure like "Niger → oil before uranium" is a red row before any
 * index, prompt or model change is made to fix it.
 *
 * A row that depends on a later PR of the knowledge-system ADR carries
 * `"pending": "PR n"` and is skipped, with the count printed: the row is the
 * spec for that PR. Remove `pending` in the PR that makes it pass.
 *
 * Rows tagged `"wall": false` test the answer ladder
 * (docs/architecture/2026-10-24-research-systems.md §1): their planned lookups
 * are RUN, offline — every tool they plan reads committed research files, so
 * the results are the ones production gets, minus the web — and the row fails
 * when the rows a correct answer needs are not in hand, when a missing link is
 * not named precisely, or when a refusal-only answer (`recordedWall`, or a
 * plain "not recorded in the corpus") would get past the wall check. A
 * question that cannot be answered is graded on its gap, not on its sorry.
 *
 * See docs/architecture/2026-10-23-knowledge-system.md §1.3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import rows from './ask-evals.json';
import { planLookups } from '../lib/chat-agent/plan';
import { readerContext } from '../lib/chat-context';
import { resolveEntity } from '../lib/entities/registry';
import { retrieve } from '../lib/index/retrieve';
import { pureResults } from '../lib/quality/pure';
import { runPlan } from '../lib/chat-agent/lookups';
import { missingLinks, wallProblem } from '../lib/chat-agent/ladder';
import { printedFormMismatches, unsupportedFigures } from '../lib/chat-agent/grounding';
import { claimProblems, stripModelTables, tableFactsIn } from '../lib/chat-agent/table-guard';
import { fixQuotes } from '../lib/chat-agent/table-prose';
import { finishInCode } from '../lib/chat-agent/check-answer';
import { GAP_SAYS, gapSentences, tableEntityWords, uncitedClaims } from '../lib/chat-agent/uncited';
import { internalProblem } from '../lib/chat-agent/internal';
import { routeQuestion } from '../lib/chat-agent/route';
import { opensWithCorpusGap, CORPUS_GAP } from '../lib/chat-agent/open-first';
import { webFigureProblems } from '../lib/chat-agent/web-figures';
import { kindOf } from '../lib/chat-agent/default-deny';
import { readFileSync } from 'node:fs';
import { emptyLedger } from '../lib/chat-tools/ledger';
import { GRADE_LABEL } from '../lib/graph/index';

interface EvalRow {
  id: string;
  /** What part of the corpus the question tests; `outside` for off-topic questions. */
  facet: string;
  question: string;
  path?: string;
  /** Entity ids a correct answer must name. */
  mustMention: string[];
  /** Terms the page entity's one-line description must not lead with. */
  mustNotLead?: string[];
  expectedTools: string[];
  /** Chunk ids that must be in the retriever's top five. */
  expectedHits: string[];
  /** A quality check that reports this row's gap today; the eval turns red when it closes. */
  gap?: string;
  /** The question is not about anything in the corpus: nothing may match most of its words. */
  outsideCorpus?: boolean;
  /** The ADR PR this row waits for; skipped until then. */
  pending?: string;
  /** `false`: the answer may never be only a refusal (the answer ladder). */
  wall?: false;
  /** The tool planned first. */
  firstTool?: string;
  /** Strings the offline lookups must return, verbatim. */
  mustHold?: string[];
  /** Ladder boxes the answer must name as missing, exactly. */
  expectedGaps?: string[];
  /** A refusal recorded live (or written to the shape of one) that the wall check must catch. */
  recordedWall?: string;
  /**
   * Relation rows the graph tools must return: the source quote verbatim, with
   * this grade and this kind of reading (table cell, curated record, verbatim).
   */
  graded?: {
    quote: string;
    grade: 'stated' | 'corroborated' | 'derived' | 'lead';
    reading: string;
  }[];
  /** A tool result recorded from a real run (test/fixtures/), and an answer recorded live over it. */
  recordedTool?: string;
  recordedAnswer?: string;
  /** Text the computed `summary` must hold. */
  summaryHolds?: string[];
  /** Parts of the recorded answer the aggregate check must flag (the table is stripped first). */
  mustFlag?: string[];
  /** The question shows no table (the guards must leave such an answer alone where it is honest). */
  noTable?: boolean;
  /** The answer names every operator the tool returned (the summary does, in code). */
  operatorsNamed?: boolean;
  /** Sentences the guards must remove; every other line of the recorded answer must survive. */
  keepAllExcept?: string[];
  /** A page-text recording whose answer had links the page text no longer shows. */
  linksLost?: boolean;
  /** How many web pages the recorded answer's lookups fetched: its [W#] may cite up to this. */
  recordedWeb?: number;
  /** Web leads the final answer must still show. */
  leadsKept?: number[];
  /** Markers around the answer in a recorded page (its first line is skipped). */
  recordedSlice?: [string, string];
  /** Text the final answer must keep (missing links, web leads) and must not. */
  mustKeep?: string[];
  mustDrop?: string[];
  /** A misquoted cell in the recorded answer, and the printed text it must become. */
  mustFixQuote?: [string, string][];
  /** Re-formatted printed figures the grounding check must flag ("50 %"). */
  mustFlagForms?: string[];
  /** A re-united quantity the grounding check must catch, and its verbatim form it must pass. */
  unitGuard?: { wrong: string; right: string };
  /** Which sources the router sends the question to (route.ts): `web` searches beside the corpus. */
  route?: 'web' | 'corpus';
  /** Text the routed web query must hold ("October 2026" for "this month"). */
  queryHolds?: string[];
  /** An answer that opened with what the corpus lacks: the reader must get the answer first. */
  recordedOpening?: string;
  recordedNote?: string;
  /** A figure cited [W1] that the passage does not print is caught; one it prints passes. */
  webFigureGuard?: { passage: string; wrong: string; right: string };
  /** Marked general knowledge: kept without a figure, dropped with one. */
  background?: { kept: string; dropped: string };
}

const EVALS = rows as EvalRow[];
const leads = async () => [];
const TOP_HITS = 5;
const MENTION_HITS = 8;
/** An off-topic question's hits must each hold under half its words. */
const OUTSIDE_MATCH = 0.5;

/**
 * Where a line puts its weight: its first clause, up to the first `;` or
 * sentence end. "Largest shares of world output …: 0.1 % of world oil …; …"
 * leads with oil; "Known for: uranium — directory says uranium; …" does not.
 */
function leadClause(line: string): string {
  return line.split(/;|\.\s/)[0].toLowerCase();
}

test('the eval set is the one the ADR names', () => {
  assert.equal(EVALS.length, 59);
  assert.equal(EVALS.filter((r) => r.route === 'web').length, 6, 'six open-web questions');
  assert.equal(EVALS.filter((r) => r.wall === false).length, 28, 'twenty-eight no-wall questions');
  assert.equal(new Set(EVALS.map((r) => r.id)).size, EVALS.length, 'ids are unique');
  const niger = EVALS.find((r) => r.id === 'niger-uranium');
  assert.ok(niger, 'niger-uranium is in the set');
  assert.deepEqual(niger.mustNotLead, ['oil', 'natural gas']);
  assert.equal(niger.gap, 'resources/directory-unmeasured');
  const facets = new Set(EVALS.map((r) => r.facet));
  for (const facet of [
    'bottleneck',
    'company',
    'country',
    'material',
    'policy',
    'science',
    'capital',
    'events',
    'jobs',
  ])
    assert.ok(facets.has(facet), `a ${facet} question`);
  assert.equal(EVALS.filter((r) => r.outsideCorpus).length, 3, 'three off-topic questions');
  for (const row of EVALS) {
    for (const id of row.mustMention)
      assert.ok(resolveEntity(id), `${row.id}: ${id} is an entity in the corpus`);
    if (row.outsideCorpus) assert.equal(row.expectedHits.length, 0, `${row.id}: expects no hits`);
  }
});

const pending = EVALS.filter((r) => r.pending);
const byPr = new Map<string, string[]>();
for (const r of pending) byPr.set(r.pending!, [...(byPr.get(r.pending!) ?? []), r.id]);
console.log(
  `ask-evals: ${EVALS.length - pending.length} run, ${pending.length} pending (${[...byPr]
    .map(([pr, ids]) => `${pr}: ${ids.join(', ')}`)
    .join('; ')})`,
);

const GENERIC_WALL = 'That is not recorded in the corpus.';

/** An answer recorded live over a tool result recorded from a real run: what the checks must do to it. */
function gradeRecorded(row: EvalRow, fresh: string[]) {
  const file = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const { results } = JSON.parse(file(row.recordedTool!)) as { results: string[] };
  const facts = tableFactsIn(results);
  // The tools still compute what was recorded: a drift here means re-record.
  assert.deepEqual(tableFactsIn(fresh), facts, 'the live tools compute the recorded result');
  if (row.noTable) assert.equal(facts, null, 'no table is shown for this question');
  else assert.ok(facts, 'the recorded result says a table is shown');
  for (const s of row.summaryHolds ?? [])
    assert.ok(facts!.summary.join(' ').includes(s), `the summary holds "${s}"`);
  const recordedPage = file(row.recordedAnswer!);
  // A page recorded as the reader saw it: the answer is the span between two markers, verbatim.
  const answer = row.recordedSlice
    ? recordedPage.slice(
        recordedPage.indexOf('\n', recordedPage.indexOf(row.recordedSlice[0])) + 1,
        recordedPage.indexOf(row.recordedSlice[1]),
      )
    : recordedPage;
  const gaps = missingLinks(row.question, results);
  const webCount = row.recordedWeb ?? 0;
  // What the reader gets in the end: every check made in code, after every revision.
  const final = finishInCode(answer, {
    facts,
    gaps,
    webCount,
    question: row.question,
    // Page text has lost the answer's links: grading it under default deny would
    // grade the recording, not the answer. Its markdown twin is graded in full.
    results: row.linksLost ? [] : results,
  });
  for (const k of row.mustKeep ?? []) assert.ok(final.includes(k), `keeps "${k}"`);
  for (const d of row.mustDrop ?? []) assert.ok(!final.includes(d), `drops "${d}"`);
  if (row.operatorsNamed && facts)
    // Named in code, from the rows the tool returned, whatever the prose did.
    for (const r of facts.rows)
      if (r.operator) assert.ok(final.includes(r.operator), `names the operator ${r.operator}`);
  // Nothing points at nothing: no "would settle it" without its gap, no title over nothing.
  if (/would settle/i.test(final)) assert.ok(GAP_SAYS.test(final), 'a settle sentence has its gap');
  if (row.linksLost) return;
  const titled = final
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const title = (l: string) =>
    /^#{1,6} /.test(l) ||
    (l.split(/\s+/).length <= 8 &&
      !/[.!?:;,\]]$/.test(l) &&
      !/\d|\[W\d/.test(l.replace(/\b(19|20)\d{2}\b/g, '')));
  titled.forEach((l, i) => {
    if (!title(l)) return;
    const next = titled[i + 1];
    // A markdown heading over a deeper heading or a bold title is its sub-section.
    const level = (x: string) => x.match(/^#+(?= )/)?.[0].length ?? 7;
    const deeper = /^#{1,6} /.test(l) && Boolean(next) && level(next) > level(l);
    assert.ok(next && (!title(next) || deeper), `a title over nothing: "${l}"`);
  });
  if (row.keepAllExcept) {
    // Everything the recorded answer said survives except the named sentences.
    let rest = answer;
    for (const x of row.keepAllExcept) rest = rest.split(x).join('');
    for (const line of rest
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean))
      assert.ok(final.includes(line), `survives: "${line}"`);
  }
  // (A recorded answer with no table is graded on the guards leaving it alone, not on its wall.)
  if (!row.noTable) assert.ok(!wallProblem(final, results), 'what the reader gets is not a wall');
  // Nothing made up: no uncited claim on a missing link or about a firm the table names.
  assert.deepEqual(
    uncitedClaims(final, {
      gaps,
      entities: tableEntityWords(facts),
      webCount,
      summary: facts?.summary,
    }),
    [],
    'no uncited claim survives',
  );
  for (const g of gaps)
    assert.equal(gapSentences(final, g.box).length, 1, `the ${g.box} gap is said once, precisely`);
  // The reader's words only: no tool or field, no reply to a send-back.
  for (const line of final.replace(/```[\s\S]*?```/g, '').split('\n'))
    assert.equal(internalProblem(line), null, `internal: ${line}`);
  for (const l of row.leadsKept ?? []) assert.ok(final.includes(`[W${l}]`), `lead [W${l}] kept`);
  if (!facts) return;

  const stripped = stripModelTables(answer, facts.printedOnce);
  assert.ok(!/^\s*\|/m.test(stripped), 'the model’s own table is stripped');
  const claims = claimProblems(stripped, facts.summary).join('\n');
  for (const f of row.mustFlag ?? []) assert.ok(claims.includes(f), `flags "${f}"`);
  // Reported as written (a narrow no-break space stays one); compared as plain spaces.
  const forms = printedFormMismatches(answer, results.join('\n')).map((f) =>
    f.replace(/[\u00a0\u202f]/g, ' '),
  );
  for (const f of row.mustFlagForms ?? []) assert.ok(forms.includes(f), `flags the form "${f}"`);
  assert.deepEqual(
    claimProblems(facts.summary.join(' '), facts.summary),
    [],
    'the summary itself passes',
  );
  for (const s of facts.summary)
    assert.equal(final.split(s).length - 1, 1, `the summary is said once: "${s}"`);
  assert.ok(
    final.replace(/^#{1,6} .+\n+/, '').startsWith(facts.summary[0]),
    'the computed summary opens the answer (under a leading heading)',
  );
  // The summary names a short table's operators itself; the prose may not redo them.
  const prose = facts.summary.reduce((t, x) => t.split(x).join(''), final).replace(/\s+/g, ' ');
  const named = facts.rows.filter((r) => r.operator && prose.includes(r.operator)).length;
  assert.ok(named < 4, `the prose redoes ${named} of the table's rows`);
  assert.equal(fixQuotes(final, facts), final, 'every quote of a cell is the printed cell');
  for (const [bad, good] of row.mustFixQuote ?? []) {
    assert.ok(answer.replace(/\s+/g, ' ').includes(bad), `the recorded answer misquotes: "${bad}"`);
    assert.ok(fixQuotes(answer, facts).includes(good), `the quote is put back: "${good}"`);
  }
}

interface RelationRowShape {
  grade: string;
  counted: boolean;
  source: { quote: string; reading: string };
}

/** Every relation row (related_to, how_connected) in a set of tool results, however deep. */
function relationRowsIn(results: string[]): RelationRowShape[] {
  const out: RelationRowShape[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (o.source && typeof o.grade === 'string' && typeof o.counted === 'boolean')
      out.push(o as unknown as RelationRowShape);
    Object.values(o).forEach(walk);
  };
  for (const r of results.filter((x) => /^\[(related_to|how_connected)\]/.test(x)))
    walk(JSON.parse(r.replace(/^\[[^\]]+\]\s*/, '')));
  return out;
}

for (const row of EVALS.filter((r) => r.wall === false || r.unitGuard)) {
  test(
    `ladder ${row.id}: ${row.question}`,
    { skip: row.pending && `pending ${row.pending}` },
    async () => {
      const context = readerContext({ path: row.path });
      const plan = planLookups(row.question, context, { leads });
      if (row.firstTool) assert.equal(plan.calls[0]?.name, row.firstTool, 'planned first');
      const looked = await runPlan(
        plan,
        row.question,
        context,
        { ledger: emptyLedger() },
        () => {},
      );
      const text = looked.results.join('\n');
      for (const s of row.mustHold ?? []) assert.ok(text.includes(s), `the lookups return "${s}"`);
      const rels = relationRowsIn(looked.results);
      for (const g of row.graded ?? []) {
        const hit = rels.filter((r) => r.source.quote === g.quote);
        assert.ok(hit.length, `a relation row quotes "${g.quote}" verbatim`);
        for (const r of hit) {
          assert.equal(r.grade, GRADE_LABEL[g.grade], `graded ${g.grade}: ${g.quote}`);
          assert.equal(r.source.reading, g.reading, `read as ${g.reading}: ${g.quote}`);
          assert.equal(r.counted, g.grade === 'stated' || g.grade === 'corroborated');
        }
      }
      if (row.unitGuard) {
        assert.ok(
          unsupportedFigures(row.unitGuard.wrong, text).length > 0,
          'the re-unit is caught',
        );
        assert.deepEqual(
          unsupportedFigures(row.unitGuard.right, text),
          [],
          'the verbatim form passes',
        );
      }
      if (row.recordedTool) gradeRecorded(row, looked.results);
      if (row.wall !== false) return;
      const gaps = missingLinks(row.question, looked.results);
      assert.deepEqual(
        gaps.map((g) => g.box),
        row.expectedGaps ?? [],
        'the missing links, named',
      );
      for (const g of gaps) {
        assert.match(g.sentence, /not in our sources/, 'a precise sentence, not a refusal');
        assert.ok(g.settles.length > 20, 'says which source would settle it');
        assert.ok(g.entity, 'files against an entity');
      }
      assert.equal(
        looked.web,
        gaps.length || looked.empty ? 'off' : undefined,
        'the web rung is tried for a gap',
      );
      for (const wall of [row.recordedWall, GENERIC_WALL].filter((w): w is string => Boolean(w)))
        assert.ok(wallProblem(wall, looked.results), `the wall check catches: ${wall}`);
    },
  );
}

for (const row of EVALS) {
  test(`eval ${row.id}: ${row.question}`, { skip: row.pending && `pending ${row.pending}` }, () => {
    const context = readerContext({ path: row.path });
    const hints = context.entity ? [context.entity.id] : [];

    const plan = planLookups(row.question, context, { leads });
    const planned = plan.calls.map((c) => c.name);
    for (const tool of row.expectedTools)
      assert.ok(planned.includes(tool), `planned ${tool} (got ${planned.join(', ') || 'none'})`);

    const hits = retrieve(row.question, { k: MENTION_HITS, entityHints: hints });
    const top = hits.slice(0, TOP_HITS).map((h) => h.chunk.id);
    for (const id of row.expectedHits)
      assert.ok(top.includes(id), `${id} in the top ${TOP_HITS} (got ${top.join(', ')})`);

    const about = new Set(hits.flatMap((h) => h.chunk.entityIds));
    for (const id of row.mustMention)
      assert.ok(about.has(id), `a top-${MENTION_HITS} hit is about ${id}`);

    if (row.mustNotLead?.length) {
      // PR 1: assert on the knownFor line once lib/known-for lands; until then
      // the page entity's summary is the line every consumer shows.
      const page = row.mustMention[0] ? resolveEntity(row.mustMention[0]) : undefined;
      assert.ok(page, 'the row names its page entity first');
      const lead = leadClause(page.summary);
      for (const term of row.mustNotLead)
        assert.ok(!lead.includes(term), `"${page.summary}" leads with ${term}`);
    }

    if (row.gap) {
      const check = pureResults().find((r) => r.check === row.gap);
      assert.ok(check, `the quality check ${row.gap} exists`);
      const page = resolveEntity(row.mustMention[0]);
      assert.ok(
        check.failures.some(
          (f) =>
            f.page === page?.href ||
            (page && f.row.toLowerCase().includes(page.name.toLowerCase())),
        ),
        `${row.gap} still reports ${row.mustMention[0]} — the gap closed; update this eval`,
      );
    }

    if (row.outsideCorpus) {
      assert.equal(
        plan.confident,
        false,
        'the planner is not confident about an off-topic question',
      );
      for (const hit of hits)
        assert.ok(
          hit.matched < OUTSIDE_MATCH,
          `${hit.chunk.id} holds ${Math.round(hit.matched * 100)}% of an off-topic question's words`,
        );
    }
  });
}

/**
 * The open-web rows (docs/architecture/2026-10-24-open-web-ask.md): the router
 * sends each to the web beside the corpus; a recorded answer that opened with
 * what the corpus lacks reaches the reader answer-first; a figure cited [W#]
 * must be in that passage; marked background carries no figure.
 */
for (const row of EVALS.filter((r) => r.route)) {
  test(`open web ${row.id}: ${row.question}`, () => {
    const route = routeQuestion(row.question, '2026-10-24');
    assert.equal(route.web, row.route === 'web', `routed to ${row.route} (${route.reasons})`);
    for (const q of row.queryHolds ?? [])
      assert.ok(route.query.includes(q), `the query "${route.query}" holds "${q}"`);
    if (row.recordedOpening) {
      const answer = readFileSync(new URL(`../${row.recordedOpening}`, import.meta.url), 'utf8');
      assert.ok(opensWithCorpusGap(answer), 'the recording opened with what the corpus lacks');
      const final = finishInCode(answer, {
        facts: null,
        gaps: [],
        webCount: 2,
        question: row.question,
        results: [],
      });
      assert.ok(!opensWithCorpusGap(final), `the reader gets the answer first: ${final}`);
      assert.ok(!/unchecked web results/i.test(final), 'no heading fences the web off');
      const gapLines = final.split(/(?<=[.!?])\s+|\n+/).filter((x) => CORPUS_GAP.test(x));
      assert.ok(gapLines.length <= 2, 'the corpus gap is said at the end, briefly');
    }
    if (row.webFigureGuard) {
      const passages = new Map([[1, row.webFigureGuard.passage]]);
      assert.ok(webFigureProblems(row.webFigureGuard.wrong, passages).length > 0, 'caught');
      assert.deepEqual(webFigureProblems(row.webFigureGuard.right, passages), [], 'passes');
    }
    if (row.background) {
      const ctx = { question: row.question, summary: [], webCount: 0, evidence: '' };
      assert.equal(kindOf(row.background.kept, ctx, []), 'background');
      assert.equal(kindOf(row.background.dropped, ctx, []), null);
    }
  });
}
