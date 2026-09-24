'use client';

import { useRef, useState } from 'react';
import type { LiveAnswer, StreamEvent, Turn, VerifyInput } from './types';

/**
 * The conversation: its turns, the answer being streamed, and the two POSTs
 * that change it (a question, a contribution). `busy`, `error` and `receipt`
 * are shared by both, so they live here together.
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
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // The answer while it is being written: what it has looked up so far, and
  // the text as it arrives.
  const [live, setLive] = useState<LiveAnswer | null>(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [contribute, setContribute] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Ask a question — or, with `verify`, check a claim: the server reads the
   * cited source and searches the web before the model answers with a verdict.
   */
  async function ask(question: string, verify?: VerifyInput) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setError('');
    setReceipt('');
    setTurns((prev) => [...prev, { role: 'user', content: text }]);
    setDraft('');
    setLive({
      steps: [],
      text: '',
      status: verify
        ? verify.source
          ? 'Reading the cited source…'
          : 'Checking the claim…'
        : 'Reading the question…',
    });
    const history = [...turns, { role: 'user' as const, content: text }].slice(-8);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          // Ignored server-side when a key is active (it names its own model).
          model,
          history: history.slice(0, -1).map((t) => ({ role: t.role, content: t.content })),
          onPath,
          topic: topic || undefined,
          ...(verify ? { verify } : {}),
          ...keyFields(),
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Request failed. Please retry.');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body.');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === 'error') throw new Error(event.error || 'Unavailable.');
          if (event.type === 'status') setLive((l) => l && { ...l, status: event.text });
          if (event.type === 'tool')
            setLive((l) => l && { ...l, steps: [...l.steps, event.label], status: event.label });
          if (event.type === 'delta') setLive((l) => l && { ...l, text: l.text + event.text });
          // The model decided to look something up after all: what it had
          // started writing is withdrawn rather than left as an answer.
          if (event.type === 'reset') setLive((l) => l && { ...l, text: '' });
          if (event.type === 'done') {
            // Every field, not two of them — `web` was once dropped here, and
            // an answer citing a passage the reader could not see went out.
            const data = event.data;
            setTurns((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: data.answer,
                sources: data.sources,
                web: data.web,
                leads: data.leads,
                followUps: data.followUps,
                trail: data.trail,
                outside: data.outside,
                degraded: data.degraded,
                verdict: data.verdict,
              },
            ]);
            setLive(null);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Connection lost. Please retry.');
    } finally {
      setBusy(false);
      setLive(null);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function sendContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get('message') ?? '');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
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

  return {
    turns,
    draft,
    setDraft,
    busy,
    live,
    error,
    setError,
    receipt,
    contribute,
    setContribute,
    ask,
    stop,
    sendContribution,
  };
}
