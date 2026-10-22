/** A thumb under an answer, as `POST /api/chat/feedback` stores it. */
import { FEEDBACK_REASONS } from '@bitbaum/chatkit';
import { z } from 'zod';
import { database } from '../db';

export const MAX_FEEDBACK_TEXT = 1000;

export const feedbackSchema = z.object({
  conversationId: z.uuid(),
  messageId: z.uuid(),
  verdict: z.enum(['up', 'down']),
  reason: z.enum(FEEDBACK_REASONS).optional(),
  text: z.string().trim().max(MAX_FEEDBACK_TEXT).optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

export async function storeFeedback(input: FeedbackInput): Promise<void> {
  await database().query(
    `INSERT INTO chat_feedback(conversation_id, message_id, verdict, reason, text)
     VALUES($1,$2,$3,$4,$5)`,
    [
      input.conversationId,
      input.messageId,
      input.verdict,
      input.reason ?? null,
      input.text ? input.text : null,
    ],
  );
}
