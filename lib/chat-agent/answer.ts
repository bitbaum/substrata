/** What the loop streams, what a finished answer carries, and the honest fallbacks. */
import { ChainExhaustedError } from '@bitbaum/ai-kit';
import type { Ledger } from '../chat-tools/ledger';
import { findBottleneck, findCompany } from '../chat-tools/resolve';
import type { ReaderContext } from '../chat-context';
import type { ChatSource } from '../chat/types';
import type { EntityKind } from '../entities/types';
import { safeArgs, type ToolRequest } from './parse';
import type { Verdict } from './verify';

export type AgentEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'delta'; text: string }
  | { type: 'reset' }
  | { type: 'done'; data: AgentAnswer }
  | { type: 'error'; error: string; kind?: 'budget' | 'byok' | 'unavailable' };

export interface AgentAnswer {
  answer: string;
  sources: ChatSource[];
  web: Ledger['web'];
  leads: Ledger['leads'];
  followUps: string[];
  /** The tool calls made, in order, as the reader-facing labels. */
  trail: string[];
  outside: boolean;
  model?: string;
  /** True when no model could answer and this is the honest fallback. */
  degraded?: boolean;
  /** Verify mode: the verdict the answer opened with. */
  verdict?: Verdict;
  /** Milliseconds from the request to the first visible text, and to the end. */
  timing?: { firstText?: number; total: number };
}

/** Why the chain came back empty, in words a reader can act on. */
export function budgetMessage(error: unknown): string | undefined {
  if (!(error instanceof ChainExhaustedError)) return undefined;
  const messages = error.failures.map((f) => f.message);
  if (!messages.length) return 'No AI provider is configured on this deployment.';
  const limited = messages.filter((m) => /: 429 /.test(m));
  if (limited.length === 0 || limited.length < messages.length) return undefined;
  if (limited.some((m) => /: 429 daily/.test(m)))
    return "Today's free AI budget is used up — every free model this site uses has refused for the day. It resets at midnight UTC. Nothing below is an AI answer; the records I had already read are listed, and search still works. With your own AI key (the Key button under the question box) Ask keeps working now.";
  return 'Every free AI model is at its per-minute limit right now. Try again in a minute; the records I had already read are listed below.';
}

export function sourcesOf(ledger: Ledger): ChatSource[] {
  return [...ledger.records.values()].map((r, i) => ({
    number: i + 1,
    id: `R${i + 1}`,
    title: r.title,
    href: r.href,
    evidence: r.evidence,
    primary: r.primary,
    kind: r.kind as EntityKind,
  }));
}

/** A lookup of the record the page is about, which the prompt already carries. */
export function isPageRecord(call: ToolRequest, context: ReaderContext): boolean {
  const entity = context.entity;
  if (!entity) return false;
  const name = String(safeArgs(call.args).name ?? '');
  if (!name) return false;
  if (
    call.name === 'get_bottleneck' ||
    (call.name === 'get_record' && entity.kind === 'bottleneck')
  )
    return entity.kind === 'bottleneck' && findBottleneck(name)?.slug === entity.key;
  if (call.name === 'get_company' || (call.name === 'get_record' && entity.kind === 'company'))
    return entity.kind === 'company' && findCompany(name)?.slug === entity.key;
  return call.name === 'get_record' && name.toLowerCase() === entity.name.toLowerCase();
}

/**
 * A question about the page the reader is on, which the pre-loaded record
 * answers — so no tool round is paid for. Deliberately narrow: it must name
 * the page ("this", "here", "it") and not reach for anything the record cannot
 * hold (news, other companies, comparisons, the web).
 */
export function answerableFromPage(question: string, hasRecord: boolean): boolean {
  if (!hasRecord || question.length > 160) return false;
  const q = question.toLowerCase();
  if (!/\b(this|here|it|its|page|summar|explain|what is|what does|why is|how is)\b/.test(q))
    return false;
  return !/\b(news|latest|today|this week|recent|lead|web|compare|versus|vs\.?|other|else|alternative|who else|competitor|price|stock|share)\b/.test(
    q,
  );
}
