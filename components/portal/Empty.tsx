import React from 'react';

import { Inquire } from './Inquire';

/**
 * The one empty (and could-not-read) state: what is missing, and the next
 * thing to do about it. `action` is that next thing as a link or button —
 * "No rows match" with nowhere to go from it is a dead end, and
 * scripts/ux/run.mjs checks every tool for one.
 */
export function Empty({
  what,
  next,
  action,
  topic,
}: {
  what: React.ReactNode;
  next?: React.ReactNode;
  action?: React.ReactNode;
  topic?: string;
}) {
  return (
    <div className="empty-state border border-dashed border-strong px-5 py-8 text-center">
      <p className="text-sm text-fg-secondary">{what}</p>
      {next && <p className="mt-1 text-xs text-fg-muted">{next}</p>}
      {action && <div className="empty-state-actions">{action}</div>}
      {topic && (
        <div className="mt-4">
          <Inquire topic={topic} />
        </div>
      )}
    </div>
  );
}
