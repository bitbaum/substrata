'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CHECK_EVENT, OPEN_EVENT, type CheckRequest } from '@/lib/ask-bridge';
import { ResearchChat } from './ResearchChat';

/**
 * Always-available research companion. Hidden on /chat, where the full page is
 * the same thing. A "Check this" anywhere on the page opens it with the claim
 * already asked.
 */
export function AskDock() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<(CheckRequest & { id: number }) | null>(null);

  useEffect(() => {
    const onCheck = (event: Event) => {
      const detail = (event as CustomEvent<CheckRequest>).detail;
      if (!detail?.claim) return;
      setPending({ ...detail, id: Date.now() });
      setOpen(true);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener(CHECK_EVENT, onCheck);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(CHECK_EVENT, onCheck);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

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
          <ResearchChat topic="" onPath={path} compact pending={pending} />
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
