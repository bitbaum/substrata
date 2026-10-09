/**
 * The ONE row of one-tap questions under the latest answer in Ask.
 *
 * Two sources used to render two rows under the same answer: the model's
 * suggested replies (chatkit's `quick_replies`, the conversation continuing
 * in the reader's voice) and Substrata's follow-ups (`followUpsFor`, questions
 * built from the records retrieval actually read). The decision was one row,
 * replies first.
 *
 *   1. REPLIES FIRST, then the follow-ups, each in its own order.
 *   2. NO SAME QUESTION TWICE, compared case-insensitively with the spacing
 *      and a trailing question mark ignored.
 *   3. AT MOST `MAX_ROW`, so it stays one tidy wrap. chatkit caps replies at
 *      four, so at least one corpus follow-up always keeps a place — the
 *      question this assistant is sure it can answer from the records.
 *
 * Every item sends text exactly as the composer would, so the row is
 * chatkit's own `ChatReplies`.
 */
export const MAX_ROW = 5;

function key(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(/\?+$/, '').toLowerCase();
}

export function answerRow(
  replies: readonly string[] = [],
  followUps: readonly string[] = [],
  max: number = MAX_ROW,
): string[] {
  const seen = new Set<string>();
  const row: string[] = [];
  for (const text of [...replies, ...followUps]) {
    const k = key(text);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    row.push(text.trim());
    if (row.length === max) break;
  }
  return row;
}
