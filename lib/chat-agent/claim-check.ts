/**
 * Claim check: how the Ask answers a question that brings material — a
 * screenshot, an attached text file, a long pasted post.
 *
 *   Reading your screenshot…   one call, a model that can see: text + claims (read-claims.ts)
 *   Checking: <claim>…         every claim searched at once, market tools where they apply (claim-plan.ts)
 *   Writing…                   bottom line, claim by claim, reasoning, what would change it (claim-shape.ts)
 *
 * then every guard the ordinary path has (check-answer.ts: the web-figure
 * guard, default deny, uncited claims), and the shape enforced in code. The
 * material's own words are the reader's, never a source: a claim stands as
 * confirmed only with a page or a record behind it.
 *
 * No model that can read pictures is reachable (ai-kit `NoVisionLinkError`,
 * raised before any request): the reader is told so in one sentence, with
 * the two ways forward — paste the text, or bring a key that reads images.
 * Never a silent failure, never a made-up reading of a picture.
 */
import { NoVisionLinkError, type ChatMessage } from '@bitbaum/ai-kit';
import { preloadPage } from '../chat-context';
import { followUpsFor } from '../chat-query';
import { emptyLedger, type ToolEnv } from '../chat-tools/ledger';
import { extrasOf, failureEvent, sourcesOf, type AgentAnswer } from './answer';
import { checkAnswer } from './check-answer';
import { claimPlan } from './claim-plan';
import { CLAIM_REASONING_SECTIONS, claimInstruction, shapeClaimAnswer } from './claim-shape';
import { runAgent } from './loop';
import { runLookups, runPlan } from './lookups';
import { finalAnswer } from './parse';
import { planLookups } from './plan';
import { systemPrompt } from './prompt';
import { readClaims, type Reading } from './read-claims';
import { readForPlan } from './research-read';
import type { ResearchInput } from './research';

export interface ClaimCheckInput extends ResearchInput {
  /** Validated data URLs (lib/chat/image.ts). Never stored. */
  images: string[];
  /** Attached text files, joined and bounded. */
  attached: string;
}

/** Said when a picture came and no reachable model reads pictures. */
export const BLIND_MESSAGE =
  'No model this site can reach right now reads pictures, so I have not looked at your screenshot — and I will not guess what it says. Paste the text of the post into the box and I will check it, or add your own AI key (one that reads images) with "Use your own AI key" under the box.';

/** What the material is called in the answer. */
export function materialName(input: { images: string[]; attached: string }): string {
  if (input.images.length > 1) return 'screenshots';
  if (input.images.length) return 'screenshot';
  return input.attached ? 'attached text' : 'pasted post';
}

/** The material, for the next turn's history: what was read, bounded. */
export function materialNote(reading: Reading, from: string): string {
  const text = reading.text.length > 1200 ? `${reading.text.slice(0, 1200)}…` : reading.text;
  return `[The reader's ${from}, as read — their material, not a source]: ${text}`;
}

export async function runClaimCheck(input: ClaimCheckInput): Promise<void> {
  const started = Date.now();
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const from = materialName(input);
  const { emit, context } = input;
  emit({ type: 'status', text: `Reading your ${from}…` });
  const ledger = emptyLedger();
  const env: ToolEnv = {
    ...input.env,
    ledger,
    step: (label) => {
      ledger.trail.push(label);
      emit({ type: 'tool', label });
    },
  };
  let reading: Reading | null;
  try {
    reading = await readClaims({ ...input, turn: input.turn });
  } catch (error) {
    if (input.env.signal?.aborted) return;
    if (error instanceof NoVisionLinkError)
      return emit({ type: 'error', kind: 'blind', error: BLIND_MESSAGE });
    return emit(failureEvent(error, ledger, { total: Date.now() - started, calls: 1 }));
  }
  if (input.env.signal?.aborted) return;
  if (!reading || !reading.claims.length) {
    if (input.images.length && !reading?.text)
      return emit({
        type: 'done',
        data: {
          answer: `I could not make out any text in the ${from}. If it is a post or an article, try a sharper screenshot, or paste its text into the box.`,
          sources: [],
          web: [],
          leads: [],
          followUps: [],
          trail: ledger.trail,
          outside: false,
        },
      });
    // Text but nothing to check (an opinion piece, a chart with no figures):
    // the ordinary Ask answers, with the material in the question as the reader's.
    const note = reading ? `\n\n${materialNote(reading, from)}` : `\n\n${input.attached}`;
    return runAgent({ ...input, question: `${input.question}${note}`.slice(0, 8000) });
  }
  const material = materialNote(reading, from);
  const plan = claimPlan(reading.claims, input.question, today);
  const claimsText = reading.claims.map((c) => c.text).join(' ');
  const corpusPlan = planLookups(claimsText, context, env);
  const marketCalls = plan.calls.filter(
    (c) => !corpusPlan.calls.some((p) => p.name === c.name && p.args === c.args),
  );
  const [preload, looked, market, read] = await Promise.all([
    preloadPage(context, env),
    runPlan(corpusPlan, claimsText, context, { ...env, web: undefined }, emit),
    marketCalls.length ? runLookups(marketCalls, context, env, emit) : Promise.resolve([]),
    readForPlan(plan, env, emit, undefined, 'Checking'),
  ]);
  if (input.env.signal?.aborted) return;
  const results = [...looked.results, ...market, read.result].filter(Boolean);
  const system = [
    systemPrompt({
      context,
      preloaded: preload?.text,
      lookedUp: results.length ? results.join('\n\n') : undefined,
      web: read.passages.length ? 'found' : read.couldNotLook ? 'could_not_look' : 'nothing',
      openWorld: true,
      gaps: looked.gaps,
      tools: [],
      byok: input.byok,
      today,
      replies: input.replies,
    }),
    claimInstruction(reading, read.passages, from),
  ].join('\n\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...input.history.slice(-4).map((t) => ({
      role: t.role,
      content: t.content.length > 900 ? `${t.content.slice(0, 900)}…` : t.content,
    })),
    { role: 'user', content: input.question.slice(0, 1500) },
  ];
  emit({ type: 'status', text: 'Writing…' });
  let calls = 1; // the reading
  let answer = '';
  let replies: string[] = [];
  let model: string | undefined;
  const skipped: string[] = [];
  try {
    calls++;
    const result = await input.turn({ messages, onText: (t) => emit({ type: 'delta', text: t }) });
    model = result.model;
    skipped.push(...(result.skipped ?? []));
    ({ answer, replies } = finalAnswer(result.text));
  } catch (error) {
    if (input.env.signal?.aborted) return;
    return emit(failureEvent(error, ledger, { total: Date.now() - started, calls, skipped }));
  }
  const checked = await checkAnswer({
    answer,
    question: input.question,
    results,
    messages,
    verify: false,
    turn: input.turn,
    emit,
    fileGap: input.fileGap,
    reasoningSections: CLAIM_REASONING_SECTIONS,
  });
  calls += checked.calls;
  // The shape last, so no revision can drop a claim's line or restore an unverified figure.
  answer = shapeClaimAnswer(checked.answer, reading, { webCount: ledger.web.length, from });
  emit({ type: 'reset' });
  const sources = sourcesOf(ledger);
  const data: AgentAnswer = {
    answer,
    sources,
    web: ledger.web,
    leads: ledger.leads,
    ...extrasOf(ledger),
    followUps: followUpsFor(sources.map((s) => ({ title: s.title, kind: s.kind }))),
    trail: ledger.trail,
    outside: ledger.web.length > 0,
    ...(replies.length ? { replies } : {}),
    material,
    model,
    timing: { total: Date.now() - started, calls, planned: plan.calls.length, skipped },
  };
  emit({ type: 'done', data });
}
