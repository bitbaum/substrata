/**
 * Research mode: how the Ask answers an analytical or forward-looking
 * question (docs/architecture/2026-10-25-research-mode.md).
 *
 * The owner, 2026-10-25: "if I ask you, what do you think will be the demand
 * on neon in the future? You should be able to give me a good response with
 * links, with everything." The open-web path searched the question once and
 * wrote; this path does what an analyst does:
 *
 *   Planning…          one model call: 3–6 sub-questions, a query each (research-plan.ts)
 *   Searching: <sub>…  every query at once, pages read, passages kept (research-read.ts)
 *   Reading <site>…    beside the corpus lookups the question and the plan name
 *   Writing…           one call, in a fixed shape (research-shape.ts)
 *
 * and then every guard the ordinary path has (check-answer.ts), the scenario
 * numbers computed in code from cited inputs (scenario-calc.ts), uncited
 * forecasts dropped, and every sub-question no page answered said and filed
 * as a gap (gaps.ts). The router (route.ts) decides; loop.ts hands over.
 */
import type { ChatMessage } from '@bitbaum/ai-kit';
import type { ByokConfig } from '../byok';
import { preloadPage, type ReaderContext } from '../chat-context';
import { followUpsFor } from '../chat-query';
import { emptyLedger, type ToolEnv } from '../chat-tools/ledger';
import type { ChatTurn } from '../chat/types';
import {
  failureEvent,
  sourcesOf,
  unwrittenAnswer,
  type AgentAnswer,
  type AgentEvent,
} from './answer';
import { checkAnswer } from './check-answer';
import { fileGap, type GapFiler } from './gaps';
import { runLookups, runPlan } from './lookups';
import { finalAnswer } from './parse';
import { planLookups } from './plan';
import { systemPrompt } from './prompt';
import { planResearch } from './research-plan';
import { readForPlan } from './research-read';
import {
  REASONING_SECTIONS,
  researchInstruction,
  scenarioStreamFilter,
  shapeAnswer,
  takeScenarioBlock,
  withoutUncitedForecasts,
} from './research-shape';
import { renderScenario, scenario, scenarioSpecIn, type ScenarioSpec } from './scenario-calc';
import type { ModelTurn } from './turn';
import { webPassagesIn } from './web-figures';

export interface ResearchInput {
  question: string;
  history: ChatTurn[];
  context: ReaderContext;
  turn: ModelTurn;
  env: Omit<ToolEnv, 'ledger'>;
  emit: (event: AgentEvent) => void;
  byok?: ByokConfig;
  today?: string;
  replies?: boolean;
  fileGap?: GapFiler;
}

export async function runResearch(input: ResearchInput): Promise<void> {
  const started = Date.now();
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  let firstText: number | undefined;
  const emit = (event: AgentEvent) => {
    if (event.type === 'delta' && firstText === undefined) firstText = Date.now() - started;
    input.emit(event);
  };
  emit({ type: 'status', text: 'Planning…' });
  const ledger = emptyLedger();
  const env: ToolEnv = {
    ...input.env,
    ledger,
    step: (label) => {
      ledger.trail.push(label);
      emit({ type: 'tool', label });
    },
  };
  const { question, context } = input;
  const corpusPlan = planLookups(question, context, env);
  // The corpus lookups the question obviously needs run while the plan is written.
  // The web is left to the plan: no generic search of the question's own words.
  const [preload, looked, plan] = await Promise.all([
    preloadPage(context, env),
    runPlan(corpusPlan, question, context, { ...env, web: undefined }, emit),
    planResearch(question, input.turn, today),
  ]);
  if (input.env.signal?.aborted) return;
  emit({ type: 'status', text: 'Searching the web…' });
  const extra = plan.calls.filter(
    (c) => !corpusPlan.calls.some((p) => p.name === c.name && p.args === c.args),
  );
  const [more, read] = await Promise.all([
    extra.length ? runLookups(extra, context, env, emit) : Promise.resolve([] as string[]),
    readForPlan(plan, env, emit),
  ]);
  const results = [...looked.results, ...more, read.result].filter(Boolean);
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
    researchInstruction(plan, read.passages),
  ].join('\n\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...input.history.slice(-4).map((t) => ({
      role: t.role,
      content: t.content.length > 900 ? `${t.content.slice(0, 900)}…` : t.content,
    })),
    { role: 'user', content: question },
  ];
  emit({ type: 'status', text: 'Writing…' });
  let calls = 1; // the plan
  let answer = '';
  let replies: string[] = [];
  let model: string | undefined;
  const skipped: string[] = [];
  try {
    let text = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const filter = scenarioStreamFilter();
      calls++;
      const result = await input.turn({
        messages,
        onText: (t) => {
          const shown = filter.feed(t);
          if (shown) emit({ type: 'delta', text: shown });
        },
      });
      const tail = filter.flush();
      if (tail) emit({ type: 'delta', text: tail });
      model = result.model;
      skipped.push(...(result.skipped ?? []));
      text += result.text;
      if (!result.truncated || attempt) break;
      // Out of output budget mid-answer: one call to finish it, as the ordinary path does.
      messages.push(
        { role: 'assistant', content: result.text },
        {
          role: 'user',
          content:
            'You stopped mid-answer. Continue exactly where you stopped; do not repeat anything.',
        },
      );
    }
    ({ answer, replies } = finalAnswer(text));
  } catch (error) {
    if (input.env.signal?.aborted) return;
    emit(
      failureEvent(error, ledger, {
        total: Date.now() - started,
        calls,
        planned: corpusPlan.calls.length,
        skipped,
      }),
    );
    return;
  }

  // The scenario block is for code: out before the guards read prose, back in computed.
  let spec: ScenarioSpec | undefined;
  const found = scenarioSpecIn(answer);
  if (found) {
    spec = found.spec;
    answer = takeScenarioBlock(answer, found.block);
  }
  const checked = await checkAnswer({
    answer,
    question,
    results,
    messages,
    verify: false,
    turn: input.turn,
    emit,
    fileGap: input.fileGap,
    reasoningSections: REASONING_SECTIONS,
  });
  calls += checked.calls;
  answer = checked.answer;
  const again = scenarioSpecIn(answer);
  if (again) {
    spec ??= again.spec;
    answer = answer.replace(again.block, '');
  }
  const computed = spec ? scenario(spec, webPassagesIn(results)) : null;
  answer = shapeAnswer(withoutUncitedForecasts(answer), {
    scenario: computed ? renderScenario(computed) : undefined,
    scenarioFailed: Boolean(spec && !computed),
    unanswered: read.unanswered,
    webCount: ledger.web.length,
  });
  // Rung 6: what no page gave is demand for research, filed.
  for (const s of read.unanswered)
    void fileGap(
      { question, box: `research:${s.id}`, topics: [plan.subject, s.id] },
      input.fileGap,
    );
  if (spec && !computed)
    void fileGap(
      { question, box: 'research:scenario-inputs', topics: [plan.subject, 'scenario-inputs'] },
      input.fileGap,
    );
  answer = answer.trim() ? answer : (unwrittenAnswer(ledger) ?? '');
  if (!answer) {
    emit({
      type: 'error',
      kind: 'unavailable',
      error: 'The model returned no answer. Please ask again.',
    });
    return;
  }
  const sources = sourcesOf(ledger);
  const data: AgentAnswer = {
    answer,
    sources,
    web: ledger.web,
    leads: ledger.leads,
    ...(ledger.tables.length ? { tables: ledger.tables } : {}),
    followUps: followUpsFor(sources.map((s) => ({ title: s.title, kind: s.kind }))),
    trail: ledger.trail,
    outside: ledger.web.length > 0,
    ...(replies.length ? { replies } : {}),
    model,
    timing: {
      firstText,
      total: Date.now() - started,
      calls,
      planned: corpusPlan.calls.length,
      skipped,
    },
  };
  emit({ type: 'done', data });
}
