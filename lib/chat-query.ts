/**
 * Turning what a reader typed into something worth searching for.
 *
 * The assistant's web lookup used to send the question verbatim. That is fine
 * for "who makes EUV optics" and useless for the question people actually ask
 * while looking at a page:
 *
 *   "who owns this company is it a public company is a private company
 *    what's the history of the company could you do"
 *
 * There is no subject in that string. Sent to a search engine it returns an
 * explainer on the difference between public and private limited companies,
 * which is exactly what came back on 2026-09-20, and the answer then
 * (correctly) reported that the passage did not address the question. The
 * reader asked about ASML, was standing on the EUV scanner page, and got a
 * paragraph about company law.
 *
 * The subject was never missing — it was on screen. This module puts it back:
 * the page the reader is on, or the first company among the retrieved rows when
 * the question is about a company and the page is not one, becomes the head of
 * the query. Everything here is pure, so it is tested without a network.
 */
import type { EntityKind } from './entities/types';

/** The page the reader is on, as far as query building cares. */
export interface QueryAnchor {
  name: string;
  kind: EntityKind;
}

/** A retrieved row, as far as query building cares. */
export interface QueryRow {
  title: string;
  kind: EntityKind;
}

/**
 * Words that mean "I am asking about an organisation".
 *
 * On a bottleneck page, "this company" does not mean the bottleneck — it means
 * whoever makes it. Resolving that to the material is how the answer ended up
 * calling ASML "the sole EUV lithography-scanner maker" and never naming it.
 */
const ABOUT_A_COMPANY =
  /\b(compan(?:y|ies)|firm|maker|manufacturer|supplier|vendor|owner|owns?|owned|ownership|shareholders?|listed|publicly|public|private|ipo|stock|share(?:s|holder)?|headquarter(?:s|ed)?|founded|founder|history|revenue|parent)\b/i;

/** Openers that carry no search value and crowd out the words that do. */
const POLITENESS =
  /^(?:(?:hi|hey|hello|ok|okay|so|and|also|please|could|can|would|will|do)\s+(?:you\s+)?(?:please\s+)?(?:tell\s+me\s+|explain\s+|give\s+me\s+)?)+/i;

const MAX_QUERY = 180;

/** One line, no politeness, short enough to be a query rather than a paragraph. */
export function condense(question: string): string {
  const flat = question.replace(/\s+/g, ' ').trim().replace(POLITENESS, '');
  if (flat.length <= MAX_QUERY) return flat;
  const cut = flat.slice(0, MAX_QUERY);
  const space = cut.lastIndexOf(' ');
  return (space > 40 ? cut.slice(0, space) : cut).trim();
}

/** Case-insensitive, so "asml" counts as naming ASML. */
function names(text: string, subject: string): boolean {
  return text.toLowerCase().includes(subject.toLowerCase());
}

/**
 * What the question is actually about, when the question does not say.
 *
 * Order matters: a question about an organisation asked on a page that is not
 * one resolves to the first company among the retrieved rows, because that is
 * what "this company" means to the person typing it.
 */
export function lookupSubject(
  question: string,
  anchor?: QueryAnchor,
  context: QueryRow[] = [],
): string | undefined {
  if (ABOUT_A_COMPANY.test(question) && anchor?.kind !== 'company') {
    const company = context.find((row) => row.kind === 'company');
    if (company) return company.title;
  }
  return anchor?.name ?? context[0]?.title;
}

/**
 * The string sent to the search engine.
 *
 * A question that already names something on screen is left alone. Prefixing
 * the page title onto "when did ASML buy Cymer" would bury the one term that
 * makes the query specific, so the test is against every row retrieved, not
 * only against the subject this module would otherwise pick.
 */
export function lookupQuery(
  question: string,
  anchor?: QueryAnchor,
  context: QueryRow[] = [],
): string {
  const core = condense(question);
  const onScreen = [anchor?.name, ...context.map((row) => row.title)].filter(
    (name): name is string => Boolean(name),
  );
  if (onScreen.some((name) => names(core, name))) return core;
  const subject = lookupSubject(question, anchor, context);
  if (!subject) return core;
  return `${subject} ${core}`.trim();
}

/**
 * Whether an answer is telling the reader the corpus does not hold this.
 *
 * This used to be `/not in your data/i` against one exact phrase, which meant a
 * model that wrote "the records do not cover" — a perfectly good refusal, and
 * one the prompt invites — never triggered the lookup that exists precisely for
 * that case. Over-matching costs one bounded search; under-matching costs the
 * reader an answer, so this leans towards looking.
 */
const NO_ANSWER: RegExp[] = [
  /not in (?:your|the) data/i,
  /\b(?:records?|corpus|data|rows?)\b[^.]{0,80}?\b(?:do(?:es)? not|don't|doesn't|cannot|can't|fail to)\b[^.]{0,40}?\b(?:contain|include|cover|identify|record|say|show|support|answer|address)/i,
  /\b(?:no|nothing)\b[^.]{0,40}?\bin (?:the )?(?:corpus|records|data)\b/i,
  /\bnot (?:covered|recorded|held|captured) (?:in|by) (?:the )?(?:corpus|records|data)\b/i,
];

export function saysNotInCorpus(answer: string): boolean {
  return NO_ANSWER.some((pattern) => pattern.test(answer));
}

/**
 * Questions worth asking next, built from what retrieval actually found.
 *
 * The old list was three copies of "Open the evidence for X", which is not a
 * question, was never sent to the browser, and was therefore rendered nowhere.
 * These are answerable by this assistant from the corpus, which is the point:
 * an answer the corpus could not carry should still end somewhere useful.
 */
export function followUpsFor(context: QueryRow[]): string[] {
  const asked: string[] = [];
  for (const row of context) {
    const question =
      row.kind === 'bottleneck'
        ? `Who is recorded as producing ${row.title}?`
        : row.kind === 'company'
          ? `What does the corpus record ${row.title} as making?`
          : row.kind === 'policy'
            ? `Which bottlenecks does ${row.title} touch?`
            : row.kind === 'country'
              ? `What is ${row.title} recorded as holding?`
              : row.kind === 'science'
                ? `How ready is ${row.title}, and what would settle it?`
                : row.kind === 'facility'
                  ? `What is ${row.title} recorded as supplying?`
                  : undefined;
    if (question && !asked.includes(question)) asked.push(question);
    if (asked.length === 3) break;
  }
  return asked;
}
