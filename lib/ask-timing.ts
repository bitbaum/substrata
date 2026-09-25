/**
 * How long Ask keeps a reader waiting — recorded per question, reported as
 * p50/p90 on /data.
 *
 * "The AI function is extremely slow" was a feeling until it was a number; this
 * keeps it a number. One row per question, with nothing that identifies the
 * question or the reader: durations, model calls, planned lookups, the link
 * that served and how many refused first. The same line goes to the journal.
 */
import { database } from './db';
import type { AgentAnswer } from './chat-agent/answer';

export type AskOutcome = 'answered' | 'budget' | 'error';

export interface AskTiming {
  outcome: AskOutcome;
  firstMs?: number;
  totalMs: number;
  calls: number;
  planned: number;
  fallbacks: number;
  model?: string;
}

export function timingOf(data: AgentAnswer): AskTiming {
  const t = data.timing;
  return {
    outcome: data.degraded ? 'budget' : 'answered',
    firstMs: t?.firstText,
    totalMs: t?.total ?? 0,
    calls: t?.calls ?? 0,
    planned: t?.planned ?? 0,
    fallbacks: t?.skipped?.length ?? 0,
    model: data.model,
  };
}

/** Log and store one question's timing. Never throws: measuring must not fail an answer. */
export async function recordAskTiming(t: AskTiming, skipped: string[] = []): Promise<void> {
  console.info(`substrata ask-timing ${JSON.stringify({ ...t, skipped })}`);
  if (!process.env.DATABASE_URL) return;
  try {
    await database().query(
      `INSERT INTO research_ask_timing(outcome, first_ms, total_ms, model_calls, planned, fallbacks, model)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        t.outcome,
        t.firstMs ?? null,
        Math.round(t.totalMs),
        t.calls,
        t.planned,
        t.fallbacks,
        t.model?.slice(0, 120) ?? null,
      ],
    );
    if (Math.random() < 0.02)
      await database().query(
        "DELETE FROM research_ask_timing WHERE at < now() - interval '30 days'",
      );
  } catch {
    // The table may not exist yet on a fresh box; the answer still stands.
  }
}

export interface AskLatency {
  questions: number;
  answered: number;
  firstP50: number | null;
  firstP90: number | null;
  totalP50: number | null;
  totalP90: number | null;
  /** Answered with a single model call. */
  oneCall: number;
}

/** p50/p90 over the last 24 hours, answered questions only for the percentiles. */
export async function askLatencyReport(): Promise<AskLatency> {
  const { rows } = await database().query<{
    questions: string;
    answered: string;
    first_p50: number | null;
    first_p90: number | null;
    total_p50: number | null;
    total_p90: number | null;
    one_call: string;
  }>(
    `SELECT count(*) AS questions,
            count(*) FILTER (WHERE outcome = 'answered') AS answered,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY first_ms) FILTER (WHERE outcome = 'answered') AS first_p50,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY first_ms) FILTER (WHERE outcome = 'answered') AS first_p90,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY total_ms) FILTER (WHERE outcome = 'answered') AS total_p50,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY total_ms) FILTER (WHERE outcome = 'answered') AS total_p90,
            count(*) FILTER (WHERE outcome = 'answered' AND model_calls = 1) AS one_call
       FROM research_ask_timing WHERE at > now() - interval '24 hours'`,
  );
  const r = rows[0];
  const ms = (v: number | null) => (v === null || v === undefined ? null : Math.round(Number(v)));
  return {
    questions: Number(r?.questions ?? 0),
    answered: Number(r?.answered ?? 0),
    firstP50: ms(r?.first_p50 ?? null),
    firstP90: ms(r?.first_p90 ?? null),
    totalP50: ms(r?.total_p50 ?? null),
    totalP90: ms(r?.total_p90 ?? null),
    oneCall: Number(r?.one_call ?? 0),
  };
}
