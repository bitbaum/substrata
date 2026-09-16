'use client';

import { useRef, useState } from 'react';

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/** Browser speech recognition. Starts on click; hidden failures stay in the button label. */
export function Dictation({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [on, setOn] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  return (
    <button
      type="button"
      className="companion-tool"
      aria-pressed={on}
      disabled={disabled}
      onClick={() => {
        const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec })
          .webkitSpeechRecognition;
        if (!Ctor) return;
        if (on && rec.current) {
          rec.current.stop();
          setOn(false);
          return;
        }
        const engine = new Ctor();
        engine.lang = 'en-GB';
        engine.continuous = false;
        engine.interimResults = false;
        engine.onresult = (event) => {
          const text = event.results[0]?.[0]?.transcript;
          if (text) onTranscript(text);
        };
        engine.onend = () => setOn(false);
        rec.current = engine;
        engine.start();
        setOn(true);
      }}
    >
      {on ? 'Stop mic' : 'Dictate'}
    </button>
  );
}
