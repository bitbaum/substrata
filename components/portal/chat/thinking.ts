import type { Thinking } from '@bitbaum/chatkit/react';
import type { Turn } from './types';

/**
 * What the assistant did before it answered, as chatkit's thought row —
 * "Thought for 12s ›" above the answer, opening to the steps — the way the
 * ChatGPT and Claude apps show it.
 *
 * It used to be a stray "3 records read" line UNDER the answer, folded in a
 * `<details>` of its own. The records are the steps of the thinking: what it
 * looked up (the trail), then the records it read, one line. The answer
 * itself links every record it relies on, so nothing is lost by folding the
 * list; the leads and web pages stay under the answer, apart, because they
 * are a different register of evidence, never records.
 */
export function thinkingFor(turn: Turn): Thinking | undefined {
  if (turn.role !== 'assistant') return undefined;
  const steps = (turn.trail ?? []).map((label) => ({ label }));
  const sources = turn.sources ?? [];
  if (sources.length)
    steps.push({
      label: `Read ${sources.length} record${sources.length === 1 ? '' : 's'}`,
      detail: sources.map((s) => s.title).join(' · '),
    } as { label: string; detail?: string });
  if (!steps.length && turn.durationMs === undefined) return undefined;
  return { durationMs: turn.durationMs, steps };
}
