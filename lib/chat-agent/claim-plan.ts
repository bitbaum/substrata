/**
 * Claim check, step two: what to look up for each claim the reading found
 * (read-claims.ts). Pure: no model, no network.
 *
 * Each claim is checked where Substrata can check it:
 * - a listed company's share price, financials or holders → the market tools
 *   (`marketCalls`, the same rule the ordinary Ask plans with), computed from
 *   daily closes rather than quoted off a page;
 * - everything, the market claims included → one web search aimed at the
 *   claim: who said it, the figure, the year — so "Gartner's $4.9T gap" looks
 *   for Gartner's page or a report quoting it, not the post that repeated it.
 *
 * The plan is a research plan (research-plan.ts) whose sub-questions are the
 * claims, so research mode's reader (research-read.ts) searches them all at
 * once, keeps the strongest pages and numbers them [W#] for every guard.
 */
import { marketCompaniesIn } from '../market-data/identity';
import { marketCalls, rangeIn } from './market-ask';
import type { ToolRequest } from './parse';
import type { Claim } from './read-claims';
import type { ResearchPlan } from './research-plan';
import { webQuery } from './plan';

/** At most this many market lookups, so a post naming ten tickers stays a bounded read. */
export const MAX_MARKET_CALLS = 3;

const STOP =
  /\b(the|a|an|of|that|this|which|who|has|have|had|its|their|about|reportedly|just|now)\b/gi;

/** The words an engine is given for one claim: attribution, figures and the claim's nouns. */
export function claimQuery(claim: Claim, today: string): string {
  const year = today.slice(0, 4);
  const words = webQuery(claim.text)
    .replace(/["“”‘’]/g, '')
    .replace(STOP, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 14)
    .join(' ');
  const who =
    claim.who && !words.toLowerCase().includes(claim.who.toLowerCase()) ? `${claim.who} ` : '';
  const dated = /\b(19|20)\d{2}\b/.test(words) ? '' : ` ${year}`;
  return `${who}${words}${dated}`.trim();
}

/** "Checking: <claim>…" — the claim shortened for the step line. */
export function claimLabel(claim: Claim): string {
  return claim.text.length > 90 ? `${claim.text.slice(0, 87).trimEnd()}…` : claim.text;
}

/** The lookups for a reading's claims: one search per claim, market calls where they apply. */
export function claimPlan(claims: Claim[], question: string, today: string): ResearchPlan {
  const calls: ToolRequest[] = [];
  const seen = new Set<string>();
  for (const claim of claims) {
    // "this month" in the claim, not in the reader's question, decides the range.
    for (const c of marketCalls(`${claim.text} share price`)) {
      const args = JSON.parse(c.args) as Record<string, unknown>;
      if (c.name === 'price_history') args.range = rangeIn(claim.text);
      const call = { name: c.name, args: JSON.stringify(args) };
      const key = `${call.name}:${call.args}`;
      if (claim.kind !== 'market' && c.name === 'price_history') continue;
      if (!seen.has(key) && calls.length < MAX_MARKET_CALLS) {
        seen.add(key);
        calls.push(call);
      }
    }
  }
  const named = marketCompaniesIn(claims.map((c) => c.text).join(' '), 1)[0];
  return {
    subject: named?.name ?? (webQuery(question).split(' ').slice(0, 6).join(' ') || 'the material'),
    subQuestions: claims.map((claim) => ({
      id: claim.id,
      ask: claimLabel(claim),
      query: claimQuery(claim, today),
    })),
    calls,
    by: 'code',
  };
}
