import Link from 'next/link';

import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { STAGES, STAGE_LABEL } from '@/config/substrata-stages';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import type { Follows } from '@/lib/follows';
import type { MarketParticipant } from '@/lib/participants';
import { FollowButton } from '@/components/portal/FollowButton';
import { bottleneckHref, marketHref } from '@/lib/links';
import { BINDING_MAX, scoreParts } from '@/components/desk/BindingScore';

/** Which bottlenecks are on the desk: technologies, then each row auto / follow / mute. */
export function RailsSettings({
  follows,
  onDesk,
  railCount,
  followedCo,
}: {
  follows: Follows;
  onDesk: ReadonlySet<string>;
  railCount: number;
  followedCo: readonly MarketParticipant[];
}) {
  const byStage = STAGES.map((stage) => ({
    stage,
    rows: BOTTLENECKS.filter((b) => b.stage === stage.id).sort((a, b) => b.binding - a.binding),
  })).filter((group) => group.rows.length > 0);
  return (
    <section id="rails" className="settings-section">
      <div className="settings-head">
        <h2>Rails</h2>
        <p>
          A rail is a bottleneck on your desk. Technologies bring in every bottleneck they touch;
          you can then follow or mute any single one. Now:{' '}
          <strong>
            {railCount} of {BOTTLENECKS.length}
          </strong>{' '}
          on your desk.
        </p>
      </div>
      <fieldset className="desk-toggle-group">
        <legend className="settings-label">Technologies</legend>
        {TECHNOLOGIES.map((t) => (
          <label key={t.id} className="desk-toggle" title={t.detail}>
            <input
              type="checkbox"
              name="topics"
              value={t.id}
              defaultChecked={follows.technologies.includes(t.id)}
            />
            <span>{t.name}</span>
          </label>
        ))}
      </fieldset>

      <div className="mt-6">
        <p className="settings-label">Each bottleneck</p>
        <p className="settings-hint">
          Auto follows your technologies. Follow keeps it on regardless; Mute keeps it off
          regardless. Sorted by binding score within each stage.
        </p>
        {byStage.map(({ stage, rows }) => (
          <details key={stage.id} className="settings-group" open>
            <summary>
              {STAGE_LABEL[stage.id]}{' '}
              <span className="text-fg-muted">
                · {rows.filter((b) => onDesk.has(b.slug)).length}/{rows.length} on desk
              </span>
            </summary>
            <ul className="settings-rails">
              {rows.map((b) => {
                const current = follows.muted.includes(b.slug)
                  ? 'mute'
                  : follows.bottlenecks.includes(b.slug)
                    ? 'follow'
                    : 'auto';
                return (
                  <li key={b.slug} className={onDesk.has(b.slug) ? '' : 'is-off'}>
                    <Link href={bottleneckHref(b.slug)} className="settings-rail-name">
                      {b.name}
                    </Link>
                    <span className="settings-rail-score" title={scoreParts(b)}>
                      {b.binding}/{BINDING_MAX}
                    </span>
                    <span className="settings-tri" role="radiogroup" aria-label={b.name}>
                      {(['auto', 'follow', 'mute'] as const).map((value) => (
                        <label key={value}>
                          <input
                            type="radio"
                            name={`rail:${b.slug}`}
                            value={value}
                            defaultChecked={current === value}
                          />
                          <span>{value[0].toUpperCase() + value.slice(1)}</span>
                        </label>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>

      <div className="mt-6">
        <p className="settings-label">Companies</p>
        {followedCo.length === 0 ? (
          <p className="settings-hint">
            None. Follow a company from its page — <Link href="/markets">browse markets</Link>. A
            followed company brings in every bottleneck it produces for.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {followedCo.map((p) => (
              <li key={p.slug} className="flex flex-wrap items-center justify-between gap-3">
                <Link href={marketHref(p.slug)}>{p.name}</Link>
                <FollowButton type="company" id={p.slug} following label={p.name} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
