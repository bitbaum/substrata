import Link from 'next/link';

import type { Bottleneck } from '@/lib/bottlenecks';
import type { DeskSettings } from '@/lib/follows';
import { BINDING_MAX, BindingScore } from './BindingScore';
import { bottleneckHref } from '@/lib/links';

export function DeskAside({
  binding,
  railCount,
  settings,
  reviewer,
}: {
  binding: Bottleneck[];
  railCount: number;
  settings: DeskSettings;
  reviewer: boolean;
}) {
  const facts: [string, string, string][] = [
    ['Rails', String(railCount), '/account/settings#rails'],
    ['Muted sites', String(settings.mutedHosts.length), '/account/settings#feed'],
    ['Muted words', String(settings.mutedWords.length), '/account/settings#feed'],
    ['Stale after', `${settings.staleAfterHours}h`, '/account/settings#sweep'],
  ];
  return (
    <aside className="desk-aside">
      <section className="desk-panel">
        <div className="desk-panel-head">
          <h2>Binding now on your rails</h2>
          <Link href="/bottlenecks">All →</Link>
        </div>
        {binding.length === 0 ? (
          <p className="text-sm text-fg-secondary">Nothing on your rails binds today.</p>
        ) : (
          <ol className="desk-binding">
            {binding.map((b) => (
              <li key={b.slug}>
                <Link href={bottleneckHref(b.slug)}>{b.name}</Link>
                <BindingScore b={b} />
              </li>
            ))}
          </ol>
        )}
        <p className="desk-panel-note">
          Score = the sum of four judged tests — supplier concentration, substitutability, lead
          time, demand inelasticity — out of {BINDING_MAX}. Hover a score for its parts; click it
          for the assessment.
        </p>
      </section>
      <section className="desk-panel">
        <div className="desk-panel-head">
          <h2>Your desk</h2>
          <Link href="/account/settings">Settings →</Link>
        </div>
        <dl className="desk-facts">
          {facts.map(([label, value, href]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <Link href={href}>{value}</Link>
              </dd>
            </div>
          ))}
        </dl>
        {reviewer && (
          <p className="mt-3 text-sm">
            <Link href="/review">Review inbox →</Link>
          </p>
        )}
      </section>
    </aside>
  );
}
