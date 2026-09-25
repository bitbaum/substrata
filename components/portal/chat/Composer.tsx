'use client';

import { useState } from 'react';
import { Dictation } from '../Dictation';
import { AiKeyPanel } from '../ai-key/AiKeyPanel';
import type { AiKey } from '../ai-key/useAiKey';
import type { useChatSession } from './useChatSession';

/**
 * One field, not five controls in a row.
 *
 * This was a textarea above a `flex-wrap` bag holding a full-width native
 * select, two square bordered boxes, a rounded filled button and a
 * borderless one — four visual weights, wrapping into two ragged lines on
 * a phone, with the model picker the loudest thing in the composer and the
 * contribution form (a different action entirely) sitting inline with Ask.
 * Now: the textarea and the tool bar share one border and read as a single
 * surface; every quiet control is the same height, the same size and the
 * same weight; Ask is the only filled thing and is always last; and
 * sending evidence sits below on its own, because it does not ask
 * anything.
 */
export function Composer({
  compact,
  chat,
  keys,
  models,
  model,
  setModel,
}: {
  compact: boolean;
  chat: ReturnType<typeof useChatSession>;
  keys: AiKey;
  models: { id: string; label: string }[];
  model: string;
  setModel: (model: string) => void;
}) {
  const { draft, setDraft, busy, contribute, setContribute, ask, stop } = chat;
  const [keyOpen, setKeyOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsId = compact ? 'dock-ask-options' : 'page-ask-options';
  const modelLabel = models.find((m) => m.id === model)?.label ?? model;
  const picker = (
    <select value={model} onChange={(e) => setModel(e.target.value)} disabled={busy}>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );

  return (
    <form
      className="companion-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (contribute) return;
        void ask(draft);
      }}
    >
      <div className="companion-field">
        <label className="sr-only" htmlFor={compact ? 'dock-ask' : 'page-ask'}>
          Ask Substrata
        </label>
        <textarea
          id={compact ? 'dock-ask' : 'page-ask'}
          rows={compact ? 2 : 3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask(draft);
            }
          }}
          placeholder="Ask about a bottleneck, a company, a country, a rule…"
          maxLength={4000}
        />
        <div className="companion-bar">
          <div className="companion-tools">
            <Dictation
              disabled={busy}
              onTranscript={(text) => setDraft((d) => (d ? `${d} ${text}` : text))}
            />
            <label className="companion-tool">
              Attach
              <input
                type="file"
                accept=".txt,.md,.csv,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  void file.text().then((text) => {
                    setDraft((d) =>
                      `${d}\n\nAttached ${file.name}:\n${text.slice(0, 2500)}`.trim(),
                    );
                  });
                }}
              />
            </label>
            {keys.active ? (
              // The reader's own key replaces the free-model picker: "which
              // free model?" no longer applies once they chose one.
              <button
                type="button"
                className="companion-byok-active"
                onClick={() => setKeyOpen((v) => !v)}
                aria-expanded={keyOpen}
                title="Answering with your own AI key — click to change or remove it"
              >
                <strong>{keys.active.label}</strong>
              </button>
            ) : (
              <>
                {/* Wide: the picker sits in the bar. Narrow (ask.css): one
                    labelled button opens it below, so it is never squeezed
                    to a letter and Ask stays on screen at 320px. */}
                <label className="companion-model">
                  <span className="sr-only">Model</span>
                  {picker}
                </label>
                <button
                  type="button"
                  className="companion-tool companion-model-toggle"
                  onClick={() => setOptionsOpen((v) => !v)}
                  aria-expanded={optionsOpen}
                  aria-controls={optionsId}
                >
                  <span className="companion-model-toggle-label">Model</span>
                  <span className="companion-model-toggle-value">{modelLabel}</span>
                </button>
                <button
                  type="button"
                  className="companion-tool companion-key-toggle"
                  onClick={() => setKeyOpen((v) => !v)}
                  aria-expanded={keyOpen}
                  title="Use any AI you have a key for: OpenAI, Anthropic, Gemini, OpenRouter, Groq…"
                >
                  Your AI key
                </button>
              </>
            )}
          </div>
          {busy ? (
            <button type="button" onClick={stop} className="companion-send is-stop">
              Stop
            </button>
          ) : (
            <button type="submit" className="companion-send" disabled={draft.trim().length < 3}>
              Ask
            </button>
          )}
        </div>
      </div>
      {optionsOpen && !keys.active && (
        <div id={optionsId} className="companion-options">
          <label className="companion-option">
            <span>Free model</span>
            {picker}
          </label>
          <button
            type="button"
            className="companion-option-key"
            onClick={() => {
              setOptionsOpen(false);
              setKeyOpen(true);
            }}
          >
            Use your own AI key instead
          </button>
        </div>
      )}
      {keyOpen && <AiKeyPanel keys={keys} onDone={() => setKeyOpen(false)} />}
      <p className="companion-aside">
        Have a source we should hold?{' '}
        <button
          type="button"
          className="companion-contribute"
          onClick={() => setContribute((v) => !v)}
        >
          {contribute ? 'Cancel contribution' : 'Send evidence'}
        </button>
      </p>
    </form>
  );
}
