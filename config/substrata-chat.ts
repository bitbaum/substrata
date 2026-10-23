/**
 * Companion questions. The ones a reader is offered are GENERATED from the
 * corpus, one per facet, rotating daily (lib/starters.ts); this typed list is
 * only the fallback for a corpus with nothing to draw from, and names no
 * entity so it can never go stale or favour one.
 */
export const CHAT_STARTERS: readonly { label: string; question: string }[] = [
  {
    label: 'What is actually binding compute?',
    question: 'What are the bottlenecks in compute, and which of them are sourced?',
  },
  {
    label: 'Is money the constraint?',
    question: 'Where is capital the binding constraint, and where is it not? Why?',
  },
  {
    label: 'What expertise is missing?',
    question: 'What expertise does this research still need?',
  },
];

/**
 * How long a question may be, for the panel and /api/chat alike. The floor is
 * two characters, not three: "No", "Ja", "OK" are whole answers in a
 * conversation — and a suggested reply the model writes may be one — while the
 * panel used to drop anything shorter than three without a word.
 */
export const QUESTION_LENGTH = { min: 2, max: 4000 } as const;
