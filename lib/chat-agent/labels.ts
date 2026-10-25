/**
 * The words an answer marks its own background with, in one place: the prompt
 * asks for them, and the code guards (default-deny.ts, grounding.ts) read them.
 *
 * "Outside the corpus —" was the label until 2026-10-24; it is still read, so
 * a model that writes it is understood, but the prompt asks for the new one:
 * the old label made every answer sound like a database apologising for itself.
 */
export const GENERAL_KNOWLEDGE = 'From general knowledge, not checked:';

/**
 * Research mode's label for the analyst's own reasoning (research-shape.ts):
 * a view, a condition, a leading indicator — held to the background rules
 * (no figure, no supplier, buyer, owner or financier link), never a forecast.
 */
export const REASONING = 'Reasoning, not a sourced forecast:';

/** A sentence (or the line it opens) the answer marks as its own background knowledge or reasoning. */
export const BACKGROUND_LABEL =
  /^\s*(?:[-*•>]\s*)?(?:\*\*|_)?(from general knowledge(?:, not checked)?|outside the corpus|außerhalb des korpus|reasoning, not a sourced forecast)\b/i;
