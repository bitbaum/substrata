'use client';

import { AiKeyPanel } from '@/components/portal/ai-key/AiKeyPanel';
import { useAiKey } from '@/components/portal/ai-key/useAiKey';

/** Which AI answers Ask for this reader: the free models, or their own key. */
export function AiSettings() {
  const keys = useAiKey();
  return (
    <section id="ai" className="settings-section">
      <div className="settings-head">
        <h2>AI</h2>
        <p>
          Ask runs on the free models this site uses, shared by every reader and rationed daily.
          Bring a key for any provider below to use your own model instead — the same tools, the
          same citation rules, streamed the same way. Summaries of news (“Summarise with AI”) and
          automatic updates run only on your own key: the free models are kept for questions.
        </p>
      </div>
      <AiKeyPanel keys={keys} />
    </section>
  );
}
