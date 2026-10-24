/**
 * The checks a written answer passes before the reader keeps it, each one
 * sending it back to the model at most once:
 *
 * 1. The wall (ladder.ts): rows came back, and the answer only says what is
 *    missing, or says rows it was handed are missing.
 * 2. A table the reader already has, redone in prose: the model's own table
 *    and per-row repeats of a once-printed figure are stripped, and counts or
 *    share aggregates it made up are replaced by the computed summary
 *    (table-guard.ts).
 *    With a table shown, the prose may not redo its rows either: runs of
 *    rows go, misquoted cells are put back, and the summary opens the
 *    answer (table-prose.ts).
 * 3. Figures from nowhere, re-united quantities and reformatted printed
 *    figures (grounding.ts).
 *
 * Then every missing link the answer ended on is filed (gaps.ts).
 *
 * In that order, because a rewrite of a wall writes new figures, and those
 * must be checked too.
 */
import type { ChatMessage } from '@bitbaum/ai-kit';
import type { AgentEvent } from './answer';
import { fileGap, type GapFiler } from './gaps';
import { reviseUnsupported, unsupportedFigures, withoutSentencesHolding } from './grounding';
import { missingLinks, reviseWall, wallProblem, type MissingLink } from './ladder';
import { finalAnswer } from './parse';
import {
  claimProblems,
  replaceClaims,
  reviseClaims,
  tableFactsIn,
  type TableFacts,
} from './table-guard';
import { openWithSummary, tableProse } from './table-prose';
import { withoutInternals } from './internal';
import { dropUncited, oneGapEach, tableEntityWords, uncitedClaims, webCountIn } from './uncited';
import type { ModelTurn } from './turn';

export async function checkAnswer(opts: {
  answer: string;
  question: string;
  /** Every tool result the answer was built from, `[tool] json`. */
  results: string[];
  messages: ChatMessage[];
  verify: boolean;
  turn: ModelTurn;
  emit: (event: AgentEvent) => void;
  /** Where each missing link is filed (gaps.ts); the bound filer when absent. */
  fileGap?: GapFiler;
}): Promise<{ answer: string; calls: number; gaps: MissingLink[] }> {
  const { messages, turn, emit } = opts;
  let answer = opts.answer;
  let calls = 0;
  if (opts.verify) return { answer, calls, gaps: [] };
  const onText = (text: string) => emit({ type: 'delta', text });

  const gaps = missingLinks(opts.question, opts.results);
  const wall = wallProblem(answer, opts.results);
  if (wall) {
    emit({ type: 'reset' });
    emit({ type: 'status', text: 'Checking the answer against what the sources hold…' });
    calls++;
    const revised = await reviseWall({
      messages,
      answer,
      problem: wall,
      links: gaps,
      turn,
      onText,
    });
    if (revised) answer = finalAnswer(revised).answer;
  }

  const facts = tableFactsIn(opts.results);
  if (facts && answer.trim()) {
    answer = tableProse(answer, facts);
    const claims = claimProblems(answer, facts.summary);
    if (claims.length) {
      emit({ type: 'reset' });
      emit({ type: 'status', text: 'Checking the counts against the table…' });
      calls++;
      const revised = await reviseClaims({
        messages,
        answer,
        claims,
        summary: facts.summary,
        turn,
        onText,
      });
      const next = revised ? tableProse(finalAnswer(revised).answer, facts) : answer;
      const left = claimProblems(next, facts.summary);
      answer = left.length ? replaceClaims(next, left, facts.summary) : next;
    }
  }

  const figures = unsupportedFigures(answer, messages.map((m) => String(m.content)).join('\n'));
  if (answer.trim() && figures.length) {
    emit({ type: 'reset' });
    emit({ type: 'status', text: 'Checking the figures against the sources…' });
    calls++;
    const revised = await reviseUnsupported({ messages, answer, figures, turn, onText });
    answer = revised ? finalAnswer(revised).answer : withoutSentencesHolding(answer, figures);
  }
  if (answer.trim())
    answer = finishInCode(answer, { facts, gaps, webCount: webCountIn(opts.results) });
  // Rung 6: every missing link the answer ended on is filed as demand.
  if (answer.trim())
    for (const gap of gaps)
      void fileGap(
        { question: opts.question, entity: gap.entity, box: gap.box, topics: gap.topics },
        opts.fileGap,
      );
  return { answer, calls, gaps };
}

/**
 * The last word, in code, after every revision so none can undo it:
 * - with a code table shown, the computed summary opens the answer and
 *   nothing of the rows is redone (table-prose.ts);
 * - nothing made up: an uncited claim on a missing link, or about a firm the
 *   table names, gives way to the gap sentence (uncited.ts);
 * - the reader's words only: no tool or field names, no reply to a
 *   send-back (internal.ts).
 */
export function finishInCode(
  answer: string,
  opts: { facts: TableFacts | null; gaps: MissingLink[]; webCount: number },
): string {
  const { facts, gaps } = opts;
  const shaped = facts ? openWithSummary(tableProse(answer, facts), facts.summary) : answer;
  const claims = uncitedClaims(shaped, {
    gaps,
    entities: tableEntityWords(facts),
    webCount: opts.webCount,
    summary: facts?.summary,
  });
  // And in the reader's words only: no tool, no field, no reply to a send-back (internal.ts).
  return withoutInternals(oneGapEach(dropUncited(shaped, claims, gaps), gaps));
}
