'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnswerFeedback } from '@bitbaum/chatkit';
import { QUESTION_LENGTH } from '@/config/substrata-chat';
import { fromWire, type WireAttachment } from '@/lib/chat/image';
import type { ThreadHandoff } from '@/lib/ask-thread';
import { readAnswerStream } from './stream';
import type { LiveAnswer, Turn, VerifyInput } from './types';

/** What a question was sent with, for the history the server sees: its words and what was read off it. */
const historyText = (t: Turn) =>
  (t.material ? `${t.content}\n\n${t.material}` : t.content).slice(0, 4000);

/**
 * The conversation: its turns, the answer being streamed, the messages
 * queued behind it, and the two POSTs that change it (a question, a
 * contribution). `busy`, `error` and `receipt` are shared by both.
 */
export function useChatSession({
  topic,
  onPath,
  model,
  keyFields,
}: {
  topic: string;
  onPath?: string;
  model: string;
  /** The active AI key's request fields (browser key or `byokStored`), or {}. */
  keyFields: () => Record<string, unknown>;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<LiveAnswer | null>(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [contribute, setContribute] = useState(false);
  // Messages sent while a turn runs (chatkit `queue`): sent, in order, when it ends.
  const queue = useRef<{ text: string; attachments: WireAttachment[] }[]>([]);
  // The thread as it stands, for a queued message sent after a turn ends.
  const latest = useRef<Turn[]>(turns);
  useEffect(() => {
    latest.current = turns;
  }, [turns]);
  const abortRef = useRef<AbortController | null>(null);
  // One id per thread, sent with every question, so the server's review log
  // can keep the turns of one conversation together.
  const conversationId = useRef<string | null>(null);
  if (conversationId.current === null) conversationId.current = crypto.randomUUID();

  /**
   * Ask a question — with attachments, or, with `verify`, check a claim.
   * Resolves false when the question was not sent, so the composer keeps the
   * draft (and its attachments) rather than dropping them without a word.
   */
  async function ask(
    question: string,
    verify?: VerifyInput,
    before: Turn[] = turns,
    attachments: WireAttachment[] = [],
  ): Promise<boolean> {
    const text = question.trim();
    if (text.length < QUESTION_LENGTH.min) return false;
    if (busy) {
      if (verify) return false;
      queue.current.push({ text, attachments });
      return true;
    }
    if (text.length > QUESTION_LENGTH.max) {
      setError(`That is over ${QUESTION_LENGTH.max.toLocaleString('en')} characters — shorten it.`);
      return false;
    }
    const files = fromWire(attachments);
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setError('');
    setReceipt('');
    const messageId = crypto.randomUUID();
    const userTurn: Turn = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      ...(files.names.length ? { attachments: files.names } : {}),
    };
    const startedAt = Date.now();
    setTurns([...before, userTurn]);
    setLive({
      steps: [],
      text: '',
      status: verify
        ? verify.source
          ? 'Reading the cited source…'
          : 'Checking the claim…'
        : files.images.length
          ? 'Reading your screenshot…'
          : 'Reading the question…',
    });
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          conversationId: conversationId.current,
          messageId,
          // Ignored server-side when a key is active (it names its own model).
          model,
          history: before.slice(-7).map((t) => ({ role: t.role, content: historyText(t) })),
          onPath,
          topic: topic || undefined,
          ...(files.images.length ? { images: files.images } : {}),
          ...(files.attached ? { attached: files.attached } : {}),
          ...(verify ? { verify } : {}),
          ...keyFields(),
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Request failed. Please retry.');
      }
      const data = await readAnswerStream(response, {
        status: (s) => setLive((l) => l && { ...l, status: s }),
        tool: (label) => setLive((l) => l && { ...l, steps: [...l.steps, label], status: label }),
        delta: (t) => setLive((l) => l && { ...l, text: l.text + t }),
        reset: () => setLive((l) => l && { ...l, text: '' }),
      });
      if (data) {
        const { answer, material, ...rest } = data;
        setTurns((prev) => [
          // What was read off a screenshot travels with the question it came with.
          ...prev.map((t) => (t.id === userTurn.id && material ? { ...t, material } : t)),
          {
            id: messageId,
            role: 'assistant',
            content: answer,
            ...rest,
            durationMs: Date.now() - startedAt,
          },
        ]);
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return true;
      setError(e instanceof Error ? e.message : 'Connection lost. Please retry.');
    } finally {
      setBusy(false);
      setLive(null);
    }
    return true;
  }

  // The turn ended: the next queued message goes, from the thread as it now stands.
  useEffect(() => {
    const next = busy ? undefined : queue.current.shift();
    if (next) void ask(next.text, undefined, latest.current, next.attachments);
    // `ask` is a fresh closure each render; the end of a turn is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  function stop() {
    abortRef.current?.abort();
    queue.current = [];
  }

  /** Continue a thread handed over from the panel (Expand): its turns and its id. */
  function restore(handoff: Pick<ThreadHandoff, 'conversationId' | 'turns'>) {
    conversationId.current = handoff.conversationId;
    setTurns(handoff.turns);
    setError('');
  }

  /** Ask the last question again, replacing its failed or unwanted answer. */
  function retry() {
    const lastUser = [...turns].reverse().find((t) => t.role === 'user');
    if (!lastUser || busy) return;
    void ask(lastUser.content, undefined, turns.slice(0, turns.lastIndexOf(lastUser)));
  }

  async function sendContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: String(form.get('message') ?? ''),
          topic,
          replyTo: form.get('replyTo'),
          creditName: form.get('creditName'),
          consent: form.get('consent') === 'on',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send.');
      setReceipt(result.data.receipt);
      setContribute(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  /** A thumb under an answer, kept with the conversation for the nightly review. */
  function feedback(input: AnswerFeedback) {
    void fetch('/api/chat/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conversationId.current, ...input }),
    }).catch(() => {
      // Thanks was already said; a lost thumb is not the reader's problem.
    });
  }

  return {
    /** One id per thread; a handoff to /chat carries it so the log continues. */
    conversationIdNow: () => conversationId.current ?? '',
    turns,
    busy,
    live,
    error,
    setError,
    receipt,
    contribute,
    setContribute,
    ask,
    stop,
    restore,
    retry,
    feedback,
    sendContribution,
  };
}
