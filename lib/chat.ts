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
import { neighbors } from './graph';

export function chatContext(question: string) {
  const documents = researchDocuments();
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
  return [...ranked, ...extra].slice(0, 10);
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

export async function answerQuestion(
  question: string,
  signal: AbortSignal,
  history: ChatTurn[] = [],
) {
  const context = chatContext(
    `${history
      .filter((t) => t.role === 'user')
      .slice(-2)
      .map((t) => t.content)
      .join(' ')} ${question}`,
  );
  const facts = factsFrom(context);
  const grounded = buildGroundedContext({
    facts,
    renderedFacts: renderFacts(facts),
  });
  const chain = usableChain(freeChain('SUBSTRATA'), process.env).slice(0, 3);
  if (!chain.length) throw new Error('No AI providers configured');
  const system = `You are Substrata, a research companion for the physical bottlenecks on the path to much faster technology. Speak plainly, like a careful analyst, not a chatbot. Answer only from the records below. Distinguish sourced findings, unverified leads, analyst judgements, and the geology directory (which is not a finding). Never invent numbers, dates, supplier relationships or citations. If the records do not support a claim, say so and point at a useful next page. Cite records as [F1], [F2]. A producer list is corpus coverage, never the entire market. Do not give personalised investment advice. You have no tools. The contribution inbox is a separate button.\n\n${grounded}`;
  const messages = [
    { role: 'system' as const, content: system },
    ...history,
    { role: 'user' as const, content: question },
  ];
  let result = await complete({
    chain,
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
      chain,
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
