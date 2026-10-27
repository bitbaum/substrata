/**
 * Ask's ONE job inside chatkit's `ChatApp`: send a turn to /api/chat and
 * resolve with the answer — Substrata's evidence riding on the message
 * (sources, web pages, leads, tables, charts) so `renderFooter` can draw it.
 * Everything else a chat app does (the list, New chat, titles, the queue,
 * Stop, reload) is chatkit's.
 *
 * Pictures and text files go as they were staged: validated again on the
 * server, never stored there; ChatApp keeps them on the device by name only.
 * A failed turn throws `ChatTurnError` with the server's own words — the "no
 * model here reads pictures" sentence above all — so that bubble says why,
 * and Retry sends the turn again with its pictures (chatkit keeps them with a
 * thrown failure, never with a returned one).
 */
import {
  ChatTurnError,
  type ChatMessageData,
  type ChatTurn,
  type ChatTurnResult,
} from '@bitbaum/chatkit/react';
import { QUESTION_LENGTH } from '@/config/substrata-chat';
import { answerRow } from '@/lib/ask-row';
import { fromWire } from '@/lib/chat/image';
import { logIdFor } from '@/lib/chat/log-id';
import { webCitations } from '@/lib/chat/web-citations';
import { readAnswerStream } from './stream';
import { thinkingFor } from './thinking';
import type { Turn, VerifyInput } from './types';

/** "Check this" requests waiting for the turn that carries their words (ResearchChat). */
export const pendingChecks = new Map<string, VerifyInput>();

/** What the server is sent as history: words, with what was read off a screenshot. */
export function historyFor(
  history: readonly ChatMessageData[],
): { role: string; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of history) {
    if (m.failed) continue;
    const material = (m as Partial<Turn>).material;
    // What was read off a picture rides with the question it came with.
    if (m.role === 'assistant' && material && out.at(-1)?.role === 'user')
      out[out.length - 1].content = `${out.at(-1)!.content}\n\n${material}`;
    out.push({ role: m.role, content: m.content });
  }
  return out.slice(-7).map((t) => ({ ...t, content: t.content.slice(0, 4000) }));
}

export function askTransport(opts: {
  topic: string;
  onPath?: string;
  model: () => string;
  keyFields: () => Record<string, unknown>;
}) {
  return async (turn: ChatTurn): Promise<ChatTurnResult> => {
    const text = turn.text.trim();
    if (text.length > QUESTION_LENGTH.max)
      throw new ChatTurnError(
        `That is over ${QUESTION_LENGTH.max.toLocaleString('en')} characters — attach it as a text file instead.`,
        { kind: 'too-long' },
      );
    const verify = pendingChecks.get(text);
    pendingChecks.delete(text);
    const files = fromWire(turn.attachments);
    const messageId = crypto.randomUUID();
    const started = Date.now();
    const steps: string[] = [];
    let live = '';
    turn.update({
      status: verify
        ? 'Checking the claim…'
        : files.images.length
          ? 'Reading your screenshot…'
          : 'Reading the question…',
    });
    let response: Response;
    try {
      response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          // The review log's ids: a uuid per chat (a temporary chat gets none).
          conversationId: turn.conversationId ? logIdFor(turn.conversationId) : undefined,
          messageId,
          model: opts.model(),
          history: historyFor(turn.history),
          onPath: opts.onPath,
          topic: opts.topic || undefined,
          ...(files.images.length ? { images: files.images } : {}),
          ...(files.attached ? { attached: files.attached } : {}),
          ...(verify ? { verify } : {}),
          ...opts.keyFields(),
        }),
        signal: turn.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new ChatTurnError('Connection lost. Please retry.', { kind: 'network' });
    }
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new ChatTurnError(result.error || 'Request failed. Please retry.', {
        kind: `http-${response.status}`,
      });
    }
    try {
      const data = await readAnswerStream(response, {
        status: (s) => turn.update({ status: s, steps: steps.map((label) => ({ label })) }),
        tool: (label) => {
          steps.push(label);
          turn.update({ status: label, steps: steps.map((l) => ({ label: l })) });
        },
        delta: (t) => {
          live += t;
          turn.update({ text: live });
        },
        reset: () => {
          live = '';
          turn.update({ text: '' });
        },
      });
      if (!data)
        throw new ChatTurnError('The model returned no answer. Please ask again.', {
          kind: 'empty',
        });
      const { answer, ...rest } = data;
      const evidence: Turn = {
        id: messageId,
        role: 'assistant',
        content: answer,
        ...rest,
        durationMs: Date.now() - started,
      };
      return {
        ...evidence,
        // A web page the answer cites is a source chip linked to the page.
        ...webCitations(answer, data.web),
        // ONE row under the latest answer: the model's replies, then the records' follow-ups.
        replies: answerRow(data.replies, data.followUps),
        thinking: thinkingFor(evidence),
        logId: messageId,
      } as ChatTurnResult;
    } catch (e) {
      if (e instanceof ChatTurnError || (e as Error).name === 'AbortError') throw e;
      // The stream broke mid-answer; its raw error is for the console, not the reader.
      throw new ChatTurnError('Connection lost. Please retry.', { kind: 'network' });
    }
  };
}
