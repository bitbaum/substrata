/** The AI-budget numbers on /data, spread into METHODS in lib/methods.ts. */
import type { Method } from './methods';

export const AI_METHODS = {
  'ai-spend': {
    title: 'AI spend by class',
    formula:
      "Tokens per UTC day on this site's free AI keys, summed per class: interactive (Ask, a reader waiting) and background (scheduled jobs). Background may spend at most 25% of the day's capacity and never below a floor of 50% left for readers.",
    explanation:
      "Capacity is the sum of each keyed free vendor's daily estimate in @bitbaum/ai-kit (set low on purpose). Tokens are the vendor's own count where it reports one and a characters÷4 estimate for streamed answers. Held = background calls refused to protect readers. The keys are shared with other apps, so a vendor can refuse before this ledger reaches capacity.",
    code: ['lib/ai-budget.ts', 'lib/event-draft-run.ts', 'lib/chat-agent/turn.ts'],
  },
  'ask-latency': {
    title: 'Ask latency (p50 / p90)',
    formula:
      'Over every Ask question in the last 24 hours that got an answer: the 50th and 90th percentile (continuous, PostgreSQL percentile_cont) of milliseconds from the request reaching the server to the first answer text streamed, and to the finished answer.',
    explanation:
      "One row per question, holding only durations, the number of model calls, lookups planned before them, the serving model and how many free links refused first — never the question or who asked. Timed on the server, so the reader's network is not included. Questions the free budget refused are counted but kept out of the percentiles. Rows older than 30 days are deleted.",
    code: ['lib/ask-timing.ts', 'lib/chat-agent/loop.ts', 'app/api/chat/route.ts'],
  },
} satisfies Record<string, Method>;
