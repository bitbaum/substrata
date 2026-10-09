/**
 * Companion starters. Config, not chrome. The model still answers from
 * retrieved corpus facts — these are only doors in.
 */
export const CHAT_STARTERS: readonly { label: string; question: string }[] = [
  {
    label: 'What is actually binding compute?',
    question: 'What are the bottlenecks in compute, and which of them are sourced?',
  },
  {
    label: 'Who makes silicon wafers?',
    question: 'Which companies make silicon wafers, and what is sourced versus unverified?',
  },
  {
    label: 'Why does Niger matter?',
    question: 'Why does Niger matter for the path, and what is directory versus a finding?',
  },
  {
    label: 'What would relieve EUV?',
    question: 'What science would relieve EUV lithography scanners, and how ready is it?',
  },
  {
    label: 'Is money the constraint?',
    question: 'For large power transformers, is capital the binding constraint? Why or why not?',
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
