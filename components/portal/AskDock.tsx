'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ResearchChat } from './ResearchChat';

/** Always-available research companion. Hidden on /chat, where the full page is the same thing. */
export function AskDock() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === '/chat') return null;

  return (
    <div className="ask-dock">
      {open && (
        <div className="ask-dock-panel" role="dialog" aria-label="Ask Substrata">
          <header className="ask-dock-head">
            <p>Ask Substrata</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              Close
            </button>
          </header>
          <ResearchChat topic="" compact />
        </div>
      )}
      <button
        type="button"
        className="ask-dock-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Ask
      </button>
    </div>
  );
}
