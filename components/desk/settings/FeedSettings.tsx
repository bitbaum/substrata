import type { Follows } from '@/lib/follows';
import { WINDOWS, WINDOW_LABEL } from '@/lib/follows';
import { ON_DEMAND_NODES } from '@/lib/sweep-store';

/** Feed defaults, freshness and profile: the rest of the reader's own settings form. */
export function FeedSettings({ follows }: { follows: Follows }) {
  const desk = follows.desk;
  return (
    <>
      <section id="feed" className="settings-section">
        <div className="settings-head">
          <h2>Feed</h2>
          <p>The defaults the desk opens with. Every one can be changed on the desk too.</p>
        </div>
        <div className="settings-grid">
          <label className="settings-check">
            <input type="checkbox" name="showVerified" defaultChecked={desk.showVerified} />
            <span>
              Verified events
              <small>Reviewed and filed by Substrata, with source and quote.</small>
            </span>
          </label>
          <label className="settings-check">
            <input type="checkbox" name="showFilings" defaultChecked={desk.showFilings} />
            <span>
              SEC filings
              <small>
                8-K, 6-K, 10-Q, annual reports and activist stakes by listed holders of your rails,
                from EDGAR.
              </small>
            </span>
          </label>
          <label className="settings-check">
            <input type="checkbox" name="showLeads" defaultChecked={desk.showLeads} />
            <span>
              Web leads
              <small>Pages the sweep found; nobody has read them yet.</small>
            </span>
          </label>
          <label className="settings-check">
            <input type="checkbox" name="strictLeads" defaultChecked={desk.strictLeads} />
            <span>
              Only leads whose headline names the rail
              <small>
                Drops pages that mention a bottleneck in passing. Can also drop a real story with an
                unusual headline.
              </small>
            </span>
          </label>
          <label className="settings-field">
            <span>Open on</span>
            <select name="window" defaultValue={desk.window}>
              {WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {w === 'all' ? WINDOW_LABEL[w] : `Last ${WINDOW_LABEL[w]}`}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Group by</span>
            <select name="grouping" defaultValue={desk.grouping}>
              <option value="day">Day</option>
              <option value="bottleneck">Rail</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Drop leads older than (days)</span>
            <input
              type="number"
              name="leadMaxAgeDays"
              min={1}
              max={365}
              defaultValue={desk.leadMaxAgeDays}
            />
          </label>
          <label className="settings-field">
            <span>Rows per page</span>
            <input type="number" name="pageSize" min={10} max={100} defaultValue={desk.pageSize} />
          </label>
          <label className="settings-field settings-wide">
            <span>Muted sites — one per line</span>
            <textarea
              name="mutedHosts"
              rows={4}
              defaultValue={desk.mutedHosts.join('\n')}
              placeholder="finance.yahoo.com"
            />
          </label>
          <label className="settings-field settings-wide">
            <span>Muted words — a row whose headline contains one is hidden</span>
            <textarea
              name="mutedWords"
              rows={4}
              defaultValue={desk.mutedWords.join('\n')}
              placeholder={'stock\nforecast'}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-head">
          <h2>Freshness</h2>
          <p>How eagerly your desk checks the web for your rails.</p>
        </div>
        <div className="settings-grid">
          <label className="settings-check">
            <input type="checkbox" name="sweepOnOpen" defaultChecked={desk.sweepOnOpen} />
            <span>
              Check stale rails when I open the desk
              <small>
                Up to {ON_DEMAND_NODES} rails at a time, in the background, after the page loads.
              </small>
            </span>
          </label>
          <label className="settings-field">
            <span>A rail is stale after (hours)</span>
            <input
              type="number"
              name="staleAfterHours"
              min={1}
              max={72}
              defaultValue={desk.staleAfterHours}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-head">
          <h2>Profile</h2>
        </div>
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-secondary">
          <legend className="settings-label">I use this desk as</legend>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="individual"
              defaultChecked={follows.kind !== 'organization'}
            />
            An individual
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="organization"
              defaultChecked={follows.kind === 'organization'}
            />
            An organisation
          </label>
        </fieldset>
      </section>
    </>
  );
}
