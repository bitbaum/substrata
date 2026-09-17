import Link from 'next/link';

import {
  CAPITAL_PROVIDERS,
  CONSTRAINT_LABEL,
  fundingFor,
  kindById,
  type CapitalProvider,
} from '@/config/substrata-capital';
import { bottleneckHref } from '../../links';
import type { Entity } from '../../entities/types';
import type { ProfileModule } from '../types';

function provider(e: Entity): CapitalProvider | undefined {
  return e.kind === 'capital' ? CAPITAL_PROVIDERS.find((c) => c.id === e.key) : undefined;
}

/** What this kind of money does — the limits are the load-bearing half. */
const mandate: ProfileModule<CapitalProvider> = {
  id: 'mandate',
  title: 'What this kind of money does',
  appliesTo: ['capital'],
  importance: 10,
  load: provider,
  Render({ data }) {
    const kind = kindById(data.kind);
    return (
      <dl className="grid gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle sm:grid-cols-2">
        {(
          [
            ['Typical cheque', kind.chequeSize],
            ['Patience', kind.horizon],
            ['Will fund', kind.willFund],
            ['Will not fund', kind.willNotFund],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-surface-raised px-4 py-3">
            <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">{label}</dt>
            <dd className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">{value}</dd>
          </div>
        ))}
      </dl>
    );
  },
};

/** Which bottlenecks its mandate covers, and whether money is the constraint there. */
const canMove: ProfileModule<CapitalProvider> = {
  id: 'can-move',
  title: 'What it could move',
  appliesTo: ['capital'],
  importance: 20,
  load: (e) => {
    const found = provider(e);
    return found && found.canMove.length > 0 ? found : null;
  },
  evidence: (c) => `${c.canMove.length} bottlenecks`,
  Render({ data }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {data.canMove.map((name) => {
            const funding = fundingFor(name);
            return (
              <li key={name} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link
                    href={bottleneckHref(name)}
                    className="text-fg-primary underline-offset-4 hover:underline"
                  >
                    {name}
                  </Link>
                  {funding && (
                    <span className="text-sm text-fg-secondary">
                      {CONSTRAINT_LABEL[funding.constraint]}
                    </span>
                  )}
                </div>
                {funding && (
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-fg-tertiary">
                    {funding.why}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          &ldquo;Could move&rdquo; means this provider&rsquo;s mandate covers the kind of asset that
          would relieve the row. It is not a claim that it has funded one, or that it should.
        </p>
      </>
    );
  },
};

/** The sentence from the provider's own page that the entry rests on. */
const source: ProfileModule<CapitalProvider> = {
  id: 'source-sentence',
  title: 'The sentence this is built on',
  appliesTo: ['capital'],
  importance: 30,
  load: provider,
  Render({ data }) {
    return (
      <blockquote className="max-w-prose border-l-2 border-accent pl-4 text-base leading-relaxed text-fg-secondary">
        {data.quote}
      </blockquote>
    );
  },
};

export { mandate, canMove, source };
