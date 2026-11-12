/** The words a web engine is given for a question (plan.ts, route.ts). */
import { familyIn } from '../chat-tools/jobs';
import { bottleneckIn, countriesIn } from './question';

export const JOBS =
  /\b(jobs?|roles?|hiring|hire|careers?|vacanc(y|ies)|openings?|positions?|retrain(ing)?|employers?|work (for|in|at))\b/;

/**
 * The search a web engine should run for the question: its subject, not its
 * wording. Seen live (2026-10-22): "What open jobs are there in Niger?" sent
 * verbatim brought back OpenAI and the Open University — the engine matched
 * "open". A jobs question searches for jobs in the country it names; any
 * other question loses its question words and keeps the names it carries.
 */
export function webQuery(question: string): string {
  const q = question.toLowerCase();
  const countries = countriesIn(question);
  const family = familyIn(question);
  const named = bottleneckIn(question);
  if (JOBS.test(q)) {
    const where = countries[0] ? ` in ${countries[0].name}` : '';
    const what = family ? family.replace(/-/g, ' ') : named ? named.name : '';
    return `${what} jobs${where}`.trim();
  }
  const stripped = question
    .replace(TO_THE_ASSISTANT, ' ')
    .replace(/^\s*(what|which|where|when|why|how (many|much|does|do|is|are))\b\s*/i, '')
    .replace(NEWS_FRAME, ' ')
    .replace(/\b(is|are|was|were|do|does|did|can|could|there|tell me|show me|about)\b\s*/gi, ' ')
    // Every "?" and "!", not only the last: a question followed by a second
    // sentence kept its "?" in the middle of the search.
    .replace(/[?!]+/g, ' ')
    .replace(/\.+\s*$/, '')
    .replace(/\s+/g, ' ')
    // What a removed phrase leaves at either end: "…: gallium", "neon prices,".
    .replace(/^[\s:;,.-]+|[\s:;,-]+$/g, '');
  return stripped || question.trim();
}

/**
 * Words said to the assistant, not about the subject: "Use the web too.",
 * "Please search online", "cite your sources". Seen live (2026-11-12): "What
 * changed for helium supply in the last month? Use the web too." was searched
 * as `changed for helium supply in the last month? Use the web too`, and the
 * engine answered with nothing.
 */
/**
 * How a question asks for news, not what it is about: "Latest news on",
 * "the latest on", "any recent updates about". The date words that say "now"
 * are turned into the month and year by route.ts, so the frame itself only
 * dilutes the search (seen live 2026-11-12: Wikipedia answered "Latest news
 * on gallium export controls 2026" with the Patriot missile).
 */
const NEWS_FRAME =
  /\b(any |the |is there any )?(latest|recent|newest)( news| updates?| developments?| changes?)?( on| about| for| regarding| in| with| concerning)?\b|\b(news|updates?|developments?) (on|about|regarding|concerning)\b/gi;

const TO_THE_ASSISTANT =
  /\b(please\b[, ]*)?((use|search|check|look (it )?up (on|in)|look (on|at)|browse|consult|include) (the )?(open |live )?(web|internet|online|news)( too| as well| also)?( for\b)?|search online|look (it|this|that) up( online)?|(with|cite|citing|give|include|show)( me)?( your| the)? sources|and cite (your |the )?sources)\b[.!]*|\bplease\b/gi;
