import Link from 'next/link';

import { BOTTLENECKS } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';
import { whenLabel } from '@/lib/desk';
import type { SweepSettings as Settings } from '@/lib/sweep';
import { STATUS_WINDOW_DAYS, type NodeStatus } from '@/lib/sweep-queue';
import { saveSweep, sweepOne } from '@/app/account/actions';

const STATUS_LABEL: Record<string, string> = {
  ok: 'Looked',
  could_not_look: 'Could not reach search',
  sweeping: 'Sweeping now',
};

/** The shared sweep: its settings (reviewers edit, everyone reads) and per-rail status. */
export function SweepSettings({
  sweep,
  statuses,
  reviewer,
  now,
}: {
  sweep: Settings;
  statuses: NodeStatus[] | null;
  reviewer: boolean;
  now: Date;
}) {
  return (
    <section id="sweep" className="settings-section">
      <div className="settings-head">
        <h2>Sweep</h2>
        <p>
          The sweep searches the web for each bottleneck with the words of a change around it, reads
          the top pages, and files what mentions the bottleneck as a lead. A timer runs it every
          hour; it only does work when a run is due.
        </p>
      </div>

      <form action={saveSweep} className="settings-grid">
        <label className="settings-field">
          <span>Run every (hours)</span>
          <input
            type="number"
            name="everyHours"
            min={1}
            max={48}
            defaultValue={sweep.everyHours}
            disabled={!reviewer}
          />
        </label>
        <label className="settings-field">
          <span>Bottlenecks per run</span>
          <input
            type="number"
            name="nodesPerRun"
            min={1}
            max={8}
            defaultValue={sweep.nodesPerRun}
            disabled={!reviewer}
          />
        </label>
        <label className="settings-field">
          <span>Pages read per bottleneck</span>
          <input
            type="number"
            name="pagesPerNode"
            min={1}
            max={8}
            defaultValue={sweep.pagesPerNode}
            disabled={!reviewer}
          />
        </label>
        <p className="settings-hint settings-wide">
          At these settings every one of the {BOTTLENECKS.length} bottlenecks is re-checked about
          every{' '}
          <strong>
            {Math.ceil(BOTTLENECKS.length / sweep.nodesPerRun) * sweep.everyHours} hours
          </strong>{' '}
          ({BOTTLENECKS.length} ÷ {sweep.nodesPerRun} per run × {sweep.everyHours}h), plus whenever
          a reader&rsquo;s desk finds one stale.
        </p>
        <label className="settings-field settings-wide">
          <span>Event words — a page must be about one of these (one per line)</span>
          <textarea
            name="eventWords"
            rows={5}
            defaultValue={sweep.eventWords.join('\n')}
            disabled={!reviewer}
          />
        </label>
        <label className="settings-field settings-wide">
          <span>Blocked sites, on top of the built-in list (one per line)</span>
          <textarea
            name="blockedHosts"
            rows={4}
            defaultValue={sweep.blockedHosts.join('\n')}
            disabled={!reviewer}
            placeholder="example.com"
          />
        </label>
        {reviewer ? (
          <div className="settings-wide">
            <button type="submit" className="research-button">
              Save sweep settings
            </button>
          </div>
        ) : (
          <p className="settings-hint settings-wide">
            The sweep is shared by every reader, so only reviewers change it. Your own muted sites
            and words above apply to your desk alone.
          </p>
        )}
      </form>

      <div className="mt-8">
        <p className="settings-label">Your rails, as the sweep last saw them</p>
        {statuses === null ? (
          <p className="settings-hint">Sweep status is unavailable right now.</p>
        ) : (
          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Bottleneck</th>
                  <th>Last checked</th>
                  <th>Result</th>
                  <th
                    title={`Leads filed in the last ${STATUS_WINDOW_DAYS} days, rejected ones excluded`}
                  >
                    Leads · {STATUS_WINDOW_DAYS}d
                  </th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...statuses]
                  .sort((a, b) => (a.lastSwept ?? '').localeCompare(b.lastSwept ?? ''))
                  .map((s) => {
                    const slug = BOTTLENECKS.find((b) => b.name === s.name)?.slug;
                    return (
                      <tr key={s.name}>
                        <td>{slug ? <Link href={bottleneckHref(slug)}>{s.name}</Link> : s.name}</td>
                        <td title={s.lastSwept ?? undefined}>
                          {s.lastSwept ? whenLabel(s.lastSwept, now) : 'never'}
                        </td>
                        <td className={s.status === 'could_not_look' ? 'text-status-warning' : ''}>
                          {s.status ? (STATUS_LABEL[s.status] ?? s.status) : '—'}
                        </td>
                        <td>
                          {slug && s.leads30d > 0 ? (
                            <Link
                              href={`/account?view=all&w=${STATUS_WINDOW_DAYS}&src=leads&rail=${slug}`}
                            >
                              {s.leads30d}
                            </Link>
                          ) : (
                            s.leads30d
                          )}
                        </td>
                        <td>
                          <form action={sweepOne}>
                            <input type="hidden" name="name" value={s.name} />
                            <button type="submit" className="desk-act">
                              Check now
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
