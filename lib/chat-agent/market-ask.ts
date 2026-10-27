/**
 * Market questions the planner can see coming: a listed company from the
 * market seed (lib/market-data/identity.ts) named beside words about its
 * share price, its financials or its holders. The calls go first, before the
 * model is asked, so a price question is answered from computed closes and a
 * drawn line — never from one close quoted off a web page.
 */
import { marketCompaniesIn } from '../market-data/identity';
import type { ToolRequest } from './parse';

const PRICE =
  /\b(stocks?|shares? price|share prices?|price|performance|perform(ed|ing)?|done|returns?|rall(y|ied)|fallen|dropped|risen|market (cap|value|capitali[sz]ation)|valuation|chart|52.week|trading|traded)\b/i;
/** Who holds the company — not what the company holds ("which stakes does X hold" is the graph's). */
const HOLDERS =
  /\b(who (owns|holds|controls)|owners?|ownership|(share|stock)holders?|holders?|investors? in|institutional|insiders?)\b/i;
const FINANCIALS =
  /\b(revenues?|sales|earnings|profits?|profitable|income|margins?|r&d|research and development|capex|capital expenditure|cash|debt|assets|financials?|fundamentals|growth)\b/i;

/** The range a question asks about; a market-value trend reads five years. */
export function rangeIn(question: string): string {
  const q = question.toLowerCase();
  if (/\b(ytd|year to date|this year)\b/.test(q)) return 'YTD';
  if (/\b(5|five)[ -]?years?\b|\btrend\b|\blong[- ]term\b/.test(q)) return '5Y';
  if (/\b(6|six)[ -]?months?\b|\bhalf[- ]year\b/.test(q)) return '6M';
  if (/\b(3|three)[ -]?months?\b|\bquarter\b/.test(q)) return '3M';
  if (/\b(last|past|this) month\b|\b(1|one)[ -]?month\b|\b30 days\b/.test(q)) return '1M';
  return '1Y';
}

export function marketCalls(question: string): ToolRequest[] {
  const companies = marketCompaniesIn(question, 2);
  if (!companies.length) return [];
  const calls: ToolRequest[] = [];
  const call = (name: string, args: Record<string, unknown>) =>
    calls.push({ name, args: JSON.stringify(args) });
  // "Revenue growth" is a financials question, not a price one.
  const financials = FINANCIALS.test(question);
  const price = PRICE.test(question) && !(financials && !/\b(stock|share)/i.test(question));
  for (const c of companies) {
    if (price) call('price_history', { company: c.name, range: rangeIn(question) });
    if (financials) call('fundamentals', { company: c.name, metrics: 'revenue,netIncome' });
    if (HOLDERS.test(question)) call('holders', { company: c.name });
  }
  return calls;
}
