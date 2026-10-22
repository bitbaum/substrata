/**
 * The questions the home page offers under its Ask box, and the way a
 * question travels from there to /chat.
 *
 * One of them is built from the corpus — the row that is worst right now — so
 * the first suggestion is always about something that is true today; the rest
 * are the curated starters marked `home` in config/substrata-chat.ts. Every
 * one is a question the corpus can answer: they are the same ones /chat
 * offers on its empty screen.
 */
import { CHAT_STARTERS, QUESTION_LENGTH } from '@/config/substrata-chat';

export interface HomeAsk {
  /** What the button says. */
  label: string;
  /** What is asked when it is pressed. */
  question: string;
}

export function homeAsks(worst: { name: string } | undefined): HomeAsk[] {
  const curated = CHAT_STARTERS.filter((s) => s.home).map(({ label, question }) => ({
    label,
    question,
  }));
  if (!worst) return curated;
  return [
    {
      label: `What would ease ${worst.name}?`,
      question: `${worst.name} is among the most binding bottlenecks right now. Why does it bind, who holds it, and what would relieve it?`,
    },
    ...curated,
  ];
}

/** Where a question from the home page goes: /chat, with the question to start. */
export function askHref(question: string): string {
  return `/chat?q=${encodeURIComponent(question.trim().slice(0, QUESTION_LENGTH.max))}`;
}

/** The `q` of /chat, or '' when it is absent or too short to be a question. */
export function startQuestion(q: string | string[] | undefined): string {
  const text = typeof q === 'string' ? q.trim().slice(0, QUESTION_LENGTH.max) : '';
  return text.length >= QUESTION_LENGTH.min ? text : '';
}
