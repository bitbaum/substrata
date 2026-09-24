import { STATE_LABEL, type FreshState } from '@/lib/freshness/status';

/** Fresh / late / stale / failing, as a word with a dot — never colour alone. */
export function StateBadge({ state }: { state: FreshState }) {
  return (
    <span className={`fresh-badge is-${state}`}>
      <span aria-hidden="true" className="fresh-dot" />
      {STATE_LABEL[state]}
    </span>
  );
}
