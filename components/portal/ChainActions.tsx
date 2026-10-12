/**
 * "What you can do" on a chain, one row per reader: who it is for, what they
 * will find, and the one link that takes them there. The rows are built from
 * the data in app/atlas/chain-actions.ts; this only lays them out.
 */
import Link from 'next/link';

import { TAKE_PART_NOT_ADVICE } from '@/config/substrata-take-part';
import type { ChainAction } from '@/app/atlas/chain-actions';

export function ChainActions({ actions }: { actions: ChainAction[] }) {
  if (actions.length === 0) return null;
  return (
    <section className="atlas-section chain-actions" aria-labelledby="chain-actions">
      <h3 id="chain-actions">What you can do</h3>
      <ul>
        {actions.map((a) => (
          <li key={a.audience}>
            <Link href={a.href} className="chain-action">
              <span className="chain-action-who">{a.who}</span>
              <span className="chain-action-line">{a.line}</span>
              <span className="chain-action-cta">
                {a.cta} <span aria-hidden>→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="atlas-fine">
        <strong>{TAKE_PART_NOT_ADVICE.lead}</strong> These are pages to read, not trades or
        decisions to make.
      </p>
    </section>
  );
}
