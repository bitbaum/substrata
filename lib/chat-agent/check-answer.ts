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
  stripModelTables,
  tableFactsIn,
} from './table-guard';
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
    answer = stripModelTables(answer, facts.printedOnce);
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
      const next = revised
        ? stripModelTables(finalAnswer(revised).answer, facts.printedOnce)
        : answer;
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
  // Rung 6: every missing link the answer ended on is filed as demand.
  if (answer.trim())
    for (const gap of gaps)
      void fileGap(
        { question: opts.question, entity: gap.entity, box: gap.box, topics: gap.topics },
        opts.fileGap,
      );
  return { answer, calls, gaps };
}
