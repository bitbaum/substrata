import { complete, freeChain, usableChain, type ChatMessage } from '@bitbaum/ai-kit';
import {
  assignFactIds,
  buildGroundedContext,
  buildRepairPrompt,
  makeFact,
  renderFacts,
  verifyAnswer,
} from '@bitbaum/ai-kit/grounding';
import { researchDocuments, scoreDocuments, type ResearchDocument } from './research-index';
import { neighbors } from './graph';
import { resolveByPath } from './entities/registry';
import { lookUp, renderWebContext, webLookupEnabled, type WebFinding } from './chat-web';
import { followUpsFor, lookupQuery, saysNotInCorpus } from './chat-query';
import { byokModelLabel, completeByok, type ByokConfig } from './byok';

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

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type ChatSource = {
  number: number;
  id: string;
  title: string;
  href: string;
  evidence: string;
  primary: string[];
  kind: ResearchDocument['kind'];
};

function factsFrom(context: ResearchDocument[]) {
  return assignFactIds(
    context.map((d) =>
      makeFact({
        kind: 'document',
        subject: d.title,
        source: d.href,
        values: {
          title: d.title,
          source: d.sources[0] ?? d.href,
          excerpt: d.text.slice(0, 1600),
        },
      }),
    ),
  );
}

export function availableModels() {
  const chain = usableChain(freeChain('SUBSTRATA'), process.env);
  return [
    { id: 'auto', label: 'Auto' },
    ...chain.map((link) => ({
      id: link.model,
      label: `${link.provider.id} · ${link.model}`,
    })),
  ];
}

/**
 * Whether a model id is one this deployment actually offers.
 *
 * The caller supplies this string, and ai-kit treats a model it does not find
 * in the chain as an instruction rather than a typo: `chainFrom()` PREPENDS it,
 * so an unrecognised id is the first thing tried, against our key. The free
 * chain is free only because every id in it is; `anthropic/claude-opus-4` sent
 * to the same OpenRouter key is a paid call we would be billed for.
 *
 * So an id is honoured only when it is already in the chain we built.
 */
export function isOfferedModel(model: string): boolean {
  if (model === 'auto') return true;
  return usableChain(freeChain('SUBSTRATA'), process.env).some((link) => link.model === model);
}

/**
 * The third register, written once.
 *
 * The corpus is the product, so this is deliberately the weakest thing the
 * assistant is allowed to say and is fenced accordingly: no citation, no
 * quantity, no supplier relationship, an explicit opening that marks it, and
 * permission to say "I do not know" rather than reach. It exists because
 * "Is this company listed?" is not a research question and answering it with a
 * wall makes the assistant look unable rather than careful.
 */
const BACKGROUND_RULES = [
  'BACKGROUND rules. Begin any sentence that uses background with "Outside the corpus —".',
  'Allowed: stable, checkable public facts — what an organisation is, where it is listed, who founded it, what a term means, roughly when it was founded.',
  'Not allowed, ever, from background: a figure, a market share, a revenue, a capacity, a lead time, a price, or a claim that one named organisation supplies another. Those are corpus claims or they are nothing.',
  'Never cite [F] or [W] for anything you answer from background.',
  'If you are not confident, say you are not sure rather than guessing.',
  'Finish by naming the most useful page in the records for this subject, as a link.',
].join(' ');

export async function answerQuestion(
  question: string,
  signal: AbortSignal,
  history: ChatTurn[] = [],
  model = 'auto',
  onPath?: string,
  /**
   * Whether this caller may leave the corpus.
   *
   * The reader's assistant should: a wall is a worse answer than a labelled
   * lead. A fact-check must not, because its whole job is to say what the
   * records support — an answer that reaches past them to defend an article is
   * the one thing it can never do.
   */
  options: { allowOutside?: boolean; byok?: ByokConfig } = {},
) {
  const allowOutside = options.allowOutside ?? true;
  const byok = options.byok;
  const here = onPath ? resolveByPath(onPath) : undefined;
  const context = chatContext(
    `${history
      .filter((t) => t.role === 'user')
      .slice(-2)
      .map((t) => t.content)
      .join(' ')} ${question}`,
    onPath,
  );
  const facts = factsFrom(context);
  const grounded = buildGroundedContext({
    facts,
    renderedFacts: renderFacts(facts),
  });
  // Two very different budgets. The free chain leads with small, cheap models
  // rationed against a shared daily pool, and 1800 tokens / 20s is generous
  // for those. A reader's own frontier key is metered by nobody but them —
  // holding it to the free tier's ceiling is the "castration" this exists to
  // avoid: a longer answer costs the reader cents, not this deployment
  // anything, so there is no reason to cut it off at the same line.
  const maxTokens = byok ? 4096 : 1800;
  const timeoutMs = byok ? 45_000 : 20_000;
  let runCompletion: (msgs: ChatMessage[]) => Promise<{ text: string }>;
  if (byok) {
    // BYOK needs no free provider configured at all — a fresh deployment with
    // zero keys of its own can still serve a reader who brings a frontier one.
    runCompletion = (msgs) => completeByok(byok, msgs, { maxTokens, timeoutMs, signal });
  } else {
    const full = usableChain(freeChain('SUBSTRATA'), process.env);
    // An id we do not offer is not a preference, it is an injection: honour only
    // what `isOfferedModel` recognises, and fall back to Auto rather than passing
    // the string on. `requested` is what reaches the provider — never `model`.
    const requested =
      model !== 'auto' && full.some((link) => link.model === model) ? model : undefined;
    const chain = requested ? full.filter((link) => link.model === requested) : full.slice(0, 3);
    const walk = chain.length ? chain : full.slice(0, 3);
    if (!walk.length) throw new Error('No AI providers configured');
    runCompletion = (msgs) =>
      complete({
        chain: walk,
        model: requested,
        timeoutMs,
        maxTokens,
        signal,
        messages: msgs,
      }).then((r) => ({ text: r.text }));
  }
  const system = [
    'You are Substrata, a research companion for the physical bottlenecks on the path to much faster technology. Speak plainly, like a careful analyst, not a chatbot.',
    // The registers are the product. Two of them existed and were enforced; the
    // third was missing, which is why "is this company listed?" — a fact no
    // reader would expect a research corpus to own — came back as a wall.
    'You answer in three registers and never blur them. RECORDS: the rows below, cited [F1], [F2]. Only these are Substrata findings. WEB: unchecked passages fetched just now, shown only when they exist, cited [W1], [W2], always described as unchecked. BACKGROUND: widely established public knowledge, allowed only when you are told it is, only for stable checkable facts, never cited, and never carrying a figure, a market share, a capacity, a lead time, a price or a supplier relationship.',
    'Distinguish sourced findings, unverified leads, analyst judgements, and the geology directory (which is not a finding). Never invent numbers, dates, supplier relationships or citations. A producer list is corpus coverage, never the entire market. Do not give personalised investment advice.',
    // A reader who can see the name on the page is not helped by a periphrasis.
    // "The sole EUV lithography-scanner maker" was a real answer; the record it
    // came from says ASML.
    'Name what you are talking about. Where the records give an organisation, a material or a rule a name, use that name — never "the company" or "the sole maker of it".',
    // The fleet rule: a gate records, it never blocks. A bare refusal is a dead
    // end, and this assistant sits on a corpus full of the next step.
    'Never stop at a refusal. If the records do not carry the answer, say so in one sentence, then say what the records DO hold on that subject and link the page for it.',
    webLookupEnabled()
      ? 'If the records do not cover the question you may be shown UNVERIFIED WEB MATERIAL below; it is not part of the corpus and must be cited as [W1], [W2] and described as unchecked.'
      : 'You have no tools.',
    'The contribution inbox is a separate button.',
    byok
      ? // Named explicitly rather than left implicit, so the model does not
        // guess at its own identity from training data. The registers above
        // still apply in full — a frontier model is trusted with more of its
        // own judgement in BACKGROUND, never with inventing a [F#] or a [W#].
        `You are being run as ${byokModelLabel(byok)}, using the reader's own API key rather than this deployment's free tier. Use your own broader knowledge and reasoning where the rules above allow BACKGROUND — you do not need to hedge as a small model would. The RECORDS/WEB/BACKGROUND boundaries above are not a limit on your capability, they are what keeps a citation on this site meaning something: never mark something [F#] unless it is one of the numbered rows below, and never invent a [W#].`
      : '',
    here
      ? `The reader is looking at ${here.name}, a ${here.kind} page, so resolve "it", "they" and "the other ones" against that record first. On a page that is not a company, "this company", "the maker" and "they" mean an organisation the records join to this page, not the page itself.`
      : '',
    grounded,
  ]
    .filter(Boolean)
    .join('\n\n');
  const messages = [
    { role: 'system' as const, content: system },
    ...history,
    { role: 'user' as const, content: question },
  ];
  let result = await runCompletion(messages);

  // The corpus could not answer. Rather than stop at a wall, look it up — and
  // come back marked as a lead, never as a row. `findings` stays separate from
  // `sources` all the way to the screen.
  let findings: WebFinding[] = [];
  let outside = false;
  const refused = saysNotInCorpus(result.text) || context.length === 0;
  if (refused && allowOutside) {
    if (webLookupEnabled()) {
      // Not the question — the question with its subject restored. A reader on
      // a bottleneck page asking "who owns this company" gives a search engine
      // nothing to work with; `lookupQuery` puts the producer back in front.
      const lookup = await lookUp(lookupQuery(question, here, context), signal);
      if (lookup.status === 'found') findings = lookup.findings;
    }
    outside = true;
    // "We did not look" and "we looked and found nothing" are different
    // answers, and the model is told which one it got — the same distinction
    // `lookUp` is careful to preserve in its own return type.
    const situation =
      findings.length > 0
        ? 'Answer using the web material above if it helps. Say plainly that it comes from the open web and has not been checked by Substrata, and cite it as [W1], [W2]. If it does not answer the question, say so, and then answer from BACKGROUND under the rules below.'
        : webLookupEnabled()
          ? 'The records do not carry this, and a web search just now turned up nothing usable. Say that much, then answer from BACKGROUND under the rules below.'
          : 'The records do not carry this, and this deployment cannot look things up. Say that much, then answer from BACKGROUND under the rules below.';
    result = await runCompletion([
      ...messages,
      ...(findings.length > 0
        ? [{ role: 'user' as const, content: renderWebContext(findings) }]
        : []),
      { role: 'user' as const, content: `${situation}\n\n${BACKGROUND_RULES}` },
    ]);
  }
  // The grounding check asks "is every entity claim here attributable to a
  // fact?" and repairs to "Not in your data." when it is not. That is right for
  // an answer claiming to BE the corpus, and wrong for one that has already
  // said it left it: run it only on the corpus-register answer, or the repair
  // reinstates exactly the wall this ladder exists to remove.
  const checked = outside
    ? { ok: true, violations: [] as ReturnType<typeof verifyAnswer>['violations'] }
    : verifyAnswer({
        answer: result.text,
        facts,
        userMessage: question,
        mode: 'entity-attribution',
        extraEvidence: context.map((d) => d.text),
      });
  if (!checked.ok && checked.violations.length > 0) {
    result = await runCompletion([
      ...messages,
      { role: 'assistant', content: result.text },
      { role: 'user', content: buildRepairPrompt(checked.violations, 'Not in your data.') },
    ]);
  }
  const sources: ChatSource[] = context.map((d, i) => ({
    number: i + 1,
    id: facts[i]?.id ?? `F${i + 1}`,
    title: d.title,
    href: d.href,
    evidence: d.evidence,
    primary: d.sources,
    kind: d.kind,
  }));
  // Questions the reader can click, rather than the instruction the old list
  // held — which was also never sent to the browser, so nothing rendered it.
  const followUps = followUpsFor(context);
  return { answer: result.text, sources, followUps, web: findings, outside };
}
