/**
 * The way a question travels from the home page's Ask box to /chat.
 *
 * The questions themselves are `homeAsks` in lib/starters.ts, drawn from the
 * corpus on the server. This file is imported by the client (the Ask box
 * builds the link), so it must stay free of the corpus and of node modules.
 */
import { QUESTION_LENGTH } from '@/config/substrata-chat';

export interface HomeAsk {
  /** What the button says. */
  label: string;
  /** What is asked when it is pressed. */
  question: string;
}

/** Where a question from the home page goes: /chat, with the question to start. */
export function askHref(question: string): string {
  return `/chat?q=${encodeURIComponent(question.trim().slice(0, QUESTION_LENGTH.max))}`;
}
