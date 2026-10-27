/**
 * Splitting an answer's line into sentences without cutting a markdown link
 * in two. A link's title may hold a full stop ("[Gartner: IaaS grows. Cloud
 * …](https://x.com/…)"): split there, a guard that dropped the first half
 * left the reader "…IaaS… ](https://x.com/…))" (seen live, a screenshot's
 * Reasoning, 2026-10-27). Every pass that rewrites an answer sentence by
 * sentence splits through here. Pure.
 */

/** A markdown link, its URL allowed one level of parentheses (Wikipedia's). */
export const MD_LINK = /\[[^\]\n]*\]\((?:[^()\s]|\([^()\s]*\))*\)/g;

/** Sentence ends: after . ! or ? and whitespace. */
export const SENTENCE_END = /(?<=[.!?])\s+/;

/** The sentences of `line`, split at `at` everywhere but inside a markdown link. */
export function sentencesIn(line: string, at: RegExp = SENTENCE_END): string[] {
  const links: string[] = [];
  const masked = line.replace(MD_LINK, (m) => `\u0000${links.push(m) - 1}\u0000`);
  return masked
    .split(at)
    .map((s) => s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => links[Number(i)]));
}
