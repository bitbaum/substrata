'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CHECK_EVENT, OPEN_EVENT, type CheckRequest } from '@/lib/ask-bridge';
import { ResearchChat } from './ResearchChat';

/**
 * Always-available research companion. Hidden on /chat, where the full page is
 * the same thing. A "Check this" anywhere on the page opens it with the claim
 * already asked.
 *
 * The panel is mounted on the first open and then kept, hidden, so Close and
 * a second tap on Ask find the thread where it was; before that first open
 * a page carries no chat at all (its status fetches run only once wanted).
 * The pill hides while the panel is open: the panel has its own Close.
 *
 * On the home page Ask is the page's own first line, so the floating button
 * is not drawn there (it sat on top of the content); a "Check this" still
 * opens the panel.
 */
export function AskDock({
  starters,
}: {
  /** The panel's empty-screen questions, drawn from the corpus by the layout. */
  starters: readonly { label: string; question: string }[];
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  if (open && !mounted) setMounted(true);
  const [pending, setPending] = useState<(CheckRequest & { id: number }) | null>(null);

  useEffect(() => {
    const onCheck = (event: Event) => {
      const detail = (event as CustomEvent<CheckRequest>).detail;
      if (!detail?.claim) return;
      setPending({ ...detail, id: Date.now() });
      setOpen(true);
    };
    const onOpen = () => {
      if (window.location.pathname !== '/') setOpen(true);
    };
    window.addEventListener(CHECK_EVENT, onCheck);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(CHECK_EVENT, onCheck);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  if (path === '/chat') return null;
  const onHome = path === '/';

  return (
    <div className="ask-dock">
      {mounted && (
        <ResearchChat
          topic=""
          onPath={path}
          compact
          open={open}
          onClose={() => setOpen(false)}
          pending={pending}
          starters={starters}
        />
      )}
      {!onHome && !open && (
        <button
          type="button"
          className="ask-dock-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          Ask
        </button>
      )}
    </div>
  );
}
