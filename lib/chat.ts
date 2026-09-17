import { complete, freeChain, usableChain } from '@bitbaum/ai-kit';
import {
  assignFactIds,
  buildGroundedContext,
  buildRepairPrompt,
  makeFact,
  renderFacts,
  verifyAnswer,
} from '@bitbaum/ai-kit/grounding';
import { researchDocuments, searchResearch, type ResearchDocument } from './research-index';
import { neighbors, GRAPH_KINDS } from './graph';
import { resolveByPath } from './entities/registry';

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
  ]);
  const terms = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].filter(
    (w) => w.length > 2 && !stop.has(w),
  );
  const scores = new Map<string, number>();
  const bump = (id: string, n: number) => scores.set(id, (scores.get(id) ?? 0) + n);
  for (const term of terms)
    for (const document of searchResearch(documents, term))
      bump(document.id, document.title.toLowerCase().includes(term) ? 4 : 1);
  const phrase = question.toLowerCase().trim();
  for (const document of documents) {
    if (phrase.length > 8 && document.title.toLowerCase().includes(phrase)) bump(document.id, 12);
  }
  const ranked = documents
    .filter((d) => scores.has(d.id))
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

export async function answerQuestion(
  question: string,
  signal: AbortSignal,
  history: ChatTurn[] = [],
  model = 'auto',
  onPath?: string,
) {
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
  const full = usableChain(freeChain('SUBSTRATA'), process.env);
  // An id we do not offer is not a preference, it is an injection: honour only
  // what `isOfferedModel` recognises, and fall back to Auto rather than passing
  // the string on. `requested` is what reaches the provider — never `model`.
  const requested =
    model !== 'auto' && full.some((link) => link.model === model) ? model : undefined;
  const chain = requested ? full.filter((link) => link.model === requested) : full.slice(0, 3);
  const walk = chain.length ? chain : full.slice(0, 3);
  if (!walk.length) throw new Error('No AI providers configured');
  const system = `You are Substrata, a research companion for the physical bottlenecks on the path to much faster technology. Speak plainly, like a careful analyst, not a chatbot. Answer only from the records below. Distinguish sourced findings, unverified leads, analyst judgements, and the geology directory (which is not a finding). Never invent numbers, dates, supplier relationships or citations. If the records do not support a claim, say so and point at a useful next page. Cite records as [F1], [F2]. A producer list is corpus coverage, never the entire market. Do not give personalised investment advice. You have no tools. The contribution inbox is a separate button.${here ? ` The reader is looking at ${here.name}, a ${here.kind} page, so resolve "it", "they" and "the other ones" against that record first.` : ''}\n\n${grounded}`;
  const messages = [
    { role: 'system' as const, content: system },
    ...history,
    { role: 'user' as const, content: question },
  ];
  let result = await complete({
    chain: walk,
    model: requested,
    timeoutMs: 20000,
    maxTokens: 1800,
    signal,
    messages,
  });
  const checked = verifyAnswer({
    answer: result.text,
    facts,
    userMessage: question,
    mode: 'entity-attribution',
    extraEvidence: context.map((d) => d.text),
  });
  if (!checked.ok && checked.violations.length > 0) {
    result = await complete({
      chain: walk,
      model: requested,
      timeoutMs: 20000,
      maxTokens: 1800,
      signal,
      messages: [
        ...messages,
        { role: 'assistant', content: result.text },
        { role: 'user', content: buildRepairPrompt(checked.violations, 'Not in your data.') },
      ],
    });
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
  const followUps = sources.slice(0, 3).map((s) => `Open the evidence for ${s.title}`);
  return { answer: result.text, sources, followUps };
}
