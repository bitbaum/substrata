/** Which corpus documents a question is about — keyword-ranked, graph-widened, page-seeded. */
import { researchDocuments, scoreDocuments, type ResearchDocument } from '../research-index';
import { neighbors } from '../graph';
import { resolveByPath } from '../entities/registry';

export function chatContext(question: string, onPath?: string) {
  const documents = researchDocuments();
  // The page the reader is on is the strongest signal there is about what they
  // mean. "What are the other fields" is unanswerable from the corpus at large
  // and obvious next to the profile it was asked on.
  const here = onPath ? resolveByPath(onPath) : undefined;
  const stop = new Set([
    'what',
    'which',
    'where',
    'when',
    'would',
    'could',
    'should',
    'about',
    'explain',
    'understand',
    'does',
    'have',
    'this',
    'that',
    'with',
    'they',
    'their',
    'there',
    'make',
    'makes',
    'the',
    'are',
    'and',
    'for',
    'how',
    'why',
    'who',
    // Superlatives, intensifiers and quantifiers: "the biggest bottleneck",
    // "the most important constraint", "right now" carry the question's
    // STRUCTURE, not its subject, and a corpus this size has enough
    // low-frequency documents that one of these words turning up by
    // coincidence in an unrelated quote (a bank's "one of the biggest
    // multilateral institutions") can outscore the real answer.
    'biggest',
    'best',
    'worst',
    'most',
    'main',
    'key',
    'major',
    'right',
    'now',
    'really',
    'actual',
    'actually',
    'development',
    // Category nouns: this whole corpus is companies, organisations and
    // materials, so asking "which companies make X" and matching the literal
    // word "companies" discriminates nothing — every row could claim it.
    'company',
    'companies',
    'organisation',
    'organisations',
    'organization',
    'organizations',
    'firm',
    'firms',
  ]);
  const terms = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].filter(
    (w) => w.length > 2 && !stop.has(w),
  );
  const scores = new Map(scoreDocuments(documents, terms).map((s) => [s.document.id, s.score]));
  const phrase = question.toLowerCase().trim();
  for (const document of documents) {
    if (phrase.length > 8 && document.title.toLowerCase().includes(phrase))
      scores.set(document.id, (scores.get(document.id) ?? 0) + 12);
  }
  // A document that clears zero only through a single near-ubiquitous word
  // (see `wordWeight` in research-index.ts) is not a match, it is shared
  // vocabulary — the corpus's own single rarest-tag matches (a company tagged
  // with exactly one technology the question asked about) sit at or above
  // this line; a document that only shares one very common word with the
  // question sits below it. Below the floor a document is dropped rather than
  // ranked low, because a low-ranked row still gets rendered on screen as a
  // citation for the answer.
  const MIN_RELEVANCE = 0.2;
  const ranked = documents
    .filter((d) => (scores.get(d.id) ?? 0) >= MIN_RELEVANCE)
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    .slice(0, 8);

  const extra: ResearchDocument[] = [];
  for (const hit of ranked.slice(0, 3)) {
    if (hit.kind === 'company') {
      for (const edge of neighbors('company', hit.id.replace(/^company:/, '')).slice(0, 3)) {
        const related = documents.find((d) => d.href === edge.to.href || d.title === edge.to.label);
        if (related && !ranked.some((r) => r.id === related.id)) extra.push(related);
      }
    }
    if (hit.kind === 'bottleneck') {
      for (const edge of neighbors('bottleneck', hit.id.replace(/^bottleneck:/, '')).slice(0, 3)) {
        const related = documents.find((d) => d.href === edge.to.href);
        if (related && !ranked.some((r) => r.id === related.id)) extra.push(related);
      }
    }
  }
  // The page under the reader goes first, with its neighbours, and is never
  // crowded out by a keyword match somewhere else in the corpus.
  const seeded: ResearchDocument[] = [];
  if (here) {
    const self = documents.find((d) => d.id === here.id);
    if (self) seeded.push(self);
    for (const edge of neighbors(here.kind as Parameters<typeof neighbors>[0], here.key).slice(
      0,
      4,
    )) {
      const related = documents.find((d) => d.href === edge.to.href);
      if (related && !seeded.some((s) => s.id === related.id)) seeded.push(related);
    }
  }
  const rest = [...ranked, ...extra].filter((d) => !seeded.some((s) => s.id === d.id));
  return [...seeded, ...rest].slice(0, 10);
}
