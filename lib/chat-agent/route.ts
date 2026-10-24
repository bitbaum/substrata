/**
 * Which sources a question needs: the corpus, the open web, or both.
 *
 * Decided 2026-10-24, after the owner read the recent chats: "the chat is
 * trying for the website's knowledge base, and it's not looking anything
 * online, and it's not acting like a large language model." Asked what
 * Kazatomprom said about its 2026 production guidance, the Ask opened with
 * "The Substrata corpus does not track Kazatomprom's forward-looking
 * volumetric guidance" and never gave the number; asked how its competitors'
 * share prices moved this month, it listed corpus country shares and said
 * Substrata "does not record real-time or monthly equity market movements".
 * The web had been a fallback rung, opened only after a corpus lookup came
 * back empty. Here it is decided UP FRONT, from the question, and searched in
 * parallel with the corpus lookups (lookups.ts `runPlan`).
 *
 * The default is to search. Only two kinds of question stay corpus-only:
 * questions about Substrata itself (its method, its writing, a page's own
 * record or score) and off-topic chat the answer will decline anyway. When
 * unsure, search — a SearXNG query on the box is free.
 *
 * See docs/architecture/2026-10-24-open-web-ask.md.
 */
import { webQuery } from './plan';

export interface Route {
  /** The corpus lookups run (they always do: the corpus is the best-curated source). */
  corpus: true;
  /** The open web is searched in parallel, before the model writes. */
  web: boolean;
  /** Why, in words, for the timing log and the tests. */
  reasons: string[];
  /** What the web engine is asked. */
  query: string;
}

/** Signals that the answer lives in the world, not only in the corpus. */
const OPEN_WORLD: [RegExp, string][] = [
  [
    /\b(news|latest|recent(ly)?|lately|today|yesterday|this (week|month|year|quarter)|last (week|month|quarter)|right now|currently|current|so far|upcoming|announc\w*|update[sd]?)\b/i,
    'news or recent',
  ],
  [
    /\b(share|stock) prices?|\bshares? (have |has )?(moved|fallen|risen|rallied|dropped)|\b(stock|share)s? (performance|moves?)\b|\bmarket (cap|moves?|reaction)\b|\bvaluations?\b/i,
    'share prices',
  ],
  [/\b(prices?|spot|cost(s|ing)?|how much (is|does|are))\b/i, 'prices'],
  [
    /\b(what did|what has|what have)\b.*\b(say|said|announce|report|tell|told)\b|\b(said|says|statement|interview|press release|comment(s|ed)?)\b/i,
    'what someone said',
  ],
  [
    /\b(guidance|forecasts?|outlook|targets?|plans? (to|for)|expects?|expected)\b/i,
    'guidance or plans',
  ],
  [/\b(earnings|results|revenue|profit|quarter(ly)?|q[1-4]|annual report|fiscal)\b/i, 'earnings'],
  [/\b(competitors?|rivals?|peers?|competition|compete|alternatives? to)\b/i, 'competitors'],
  [
    /\b(ceo|cfo|chair(man|woman)?|founder|minister|president|who (runs|leads|heads)|people|person|executives?)\b/i,
    'people',
  ],
  [
    /\b(why|how (does|do|did|is|are|can|could|would)|explain|what is a|what are|what does .* do|meaning of|difference between)\b/i,
    'explanation',
  ],
  [
    /\b(deals?|acquisitions?|acquired?|merger|contracts?|signed|agreements?|partnerships?|joint venture)\b/i,
    'deals',
  ],
];

/** Questions about Substrata itself: its own writing, method, scores and the page's record. */
const ABOUT_SUBSTRATA =
  /\b(substrata|this site|your (method|methodology|scores?|grades?|notes?|data|sources?|corpus))\b|\b(methodology|evidence state|how well sourced|horizon (score|grade)|on this page|this (record|page))\b/i;

/** Off-topic chat: the answer declines it in one sentence, so nothing is searched for it. */
const OFF_TOPIC =
  /\b(recipes?|cook(ing)?|bake|football|soccer|basketball|tennis|horoscope|joke|poem|song lyrics|weather (in|today|tomorrow)|movie|tv show|dating)\b/i;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * The words an engine is given: the question's subject (plan.ts `webQuery`),
 * with "this month", "today" and "latest" made into the dates they mean, so an
 * engine ranks this month's pages over last year's.
 */
export function searchQueryFor(question: string, today: string): string {
  const base = webQuery(question);
  const [y, m] = today.split('-').map(Number);
  const month = MONTHS[(m || 1) - 1];
  const dated = base
    .replace(/\bthis month\b/gi, `${month} ${y}`)
    .replace(/\bthis year\b/gi, String(y))
    .replace(/\b(today|right now|currently)\b/gi, `${month} ${y}`);
  const timely = /\b(latest|recent|news|today|this (week|month)|now|current)\b/i.test(question);
  return timely && !dated.includes(String(y)) ? `${dated} ${y}` : dated;
}

/** Which sources this question needs. Pure: no model, no network. */
export function routeQuestion(
  question: string,
  today = new Date().toISOString().slice(0, 10),
): Route {
  const query = searchQueryFor(question, today);
  const reasons = OPEN_WORLD.filter(([re]) => re.test(question)).map(([, why]) => why);
  if (OFF_TOPIC.test(question) && !reasons.includes('prices'))
    return { corpus: true, web: false, reasons: ['off-topic'], query };
  // About Substrata itself, with no sign of the world outside: the corpus is the answer.
  if (ABOUT_SUBSTRATA.test(question) && !reasons.some((r) => r !== 'explanation'))
    return { corpus: true, web: false, reasons: ['about Substrata itself'], query };
  return {
    corpus: true,
    web: true,
    reasons: reasons.length ? reasons : ['the corpus may cover only part of it'],
    query,
  };
}
