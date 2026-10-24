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
import { unsupportedFigures } from '../lib/chat-agent/grounding';
import { emptyLedger } from '../lib/chat-tools/ledger';

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
  /** A re-united quantity the grounding check must catch, and its verbatim form it must pass. */
  unitGuard?: { wrong: string; right: string };
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
  assert.equal(EVALS.length, 27);
  assert.equal(EVALS.filter((r) => r.wall === false).length, 6, 'six no-wall questions');
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
