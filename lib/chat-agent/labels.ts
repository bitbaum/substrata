/**
 * The words an answer marks its own background with, in one place: the prompt
 * asks for them, and the code guards (default-deny.ts, grounding.ts) read them.
 *
 * "Outside the corpus —" was the label until 2026-10-24; it is still read, so
 * a model that writes it is understood, but the prompt asks for the new one:
 * the old label made every answer sound like a database apologising for itself.
 */
export const GENERAL_KNOWLEDGE = 'From general knowledge, not checked:';

/** A sentence (or the line it opens) the answer marks as its own background knowledge. */
export const BACKGROUND_LABEL =
  /^\s*(?:[-*•>]\s*)?(?:\*\*|_)?(from general knowledge(?:, not checked)?|outside the corpus|außerhalb des korpus)\b/i;
