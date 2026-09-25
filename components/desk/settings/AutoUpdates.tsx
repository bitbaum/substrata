import { saveAutoUpdates } from '@/app/account/actions';
import { AUTO_DRAFT_CAPS, type DeskSettings } from '@/lib/follows';
import type { StoredKey } from '@/lib/byok-vault';
import { TOKENS_PER_DRAFT } from '@/lib/update-shared';

const k = (n: number) => `${Math.round(n / 1000)}k`;

/**
 * Automatic AI updates: hourly drafts of new leads on the reader's rails, on
 * the key saved on their account — and only then. The site's free AI never
 * runs in the background, so without a saved key the switch stays off and
 * says why.
 */
export function AutoUpdates({
  desk,
  stored,
  vaultOn,
}: {
  desk: DeskSettings;
  stored: StoredKey | null;
  vaultOn: boolean;
}) {
  const perDay = desk.autoDraftPerDay;
  return (
    <section id="auto-updates" className="settings-section">
      <div className="settings-head">
        <h2>Automatic AI updates</h2>
        <p>
          Every hour, new web leads on your bottlenecks are read and drafted into events for review
          — on <strong>your own AI key</strong>, saved on your account. Nothing runs on the free AI
          this site keeps for questions, and nothing runs at all unless you switch it on. A draft
          costs your key about {TOKENS_PER_DRAFT.toLocaleString('en-US')} tokens (measured), so a
          cap of {perDay} a day is at most about {k(perDay * TOKENS_PER_DRAFT)} tokens a day. The
          drafts join the shared review queue; the leads drafted are only ever those on your desk.
        </p>
      </div>
      {!stored && (
        <p className="settings-hint">
          {vaultOn
            ? 'Save a key on your account first (AI, above — choose “on my account”). A key kept only in this browser cannot run while you are away.'
            : 'Keys cannot be saved on accounts on this server yet, so automatic updates are unavailable. “Update news now” and “Summarise with AI” still work with a key in your browser.'}
        </p>
      )}
      <form action={saveAutoUpdates} className="settings-form">
        <label className="settings-check">
          <input
            type="checkbox"
            name="autoDraft"
            defaultChecked={desk.autoDraft && Boolean(stored)}
            disabled={!stored}
          />
          <span>
            Automatic AI updates for my bottlenecks
            {stored && ` — on ${stored.vendor}/${stored.model}, key ${stored.hint}`}
          </span>
        </label>
        <label className="settings-field">
          <span>At most this many drafts a day</span>
          <select name="autoDraftPerDay" defaultValue={String(perDay)} disabled={!stored}>
            {AUTO_DRAFT_CAPS.map((cap) => (
              <option key={cap} value={cap}>
                {cap} (≈ {k(cap * TOKENS_PER_DRAFT)} tokens)
              </option>
            ))}
          </select>
        </label>
        <div className="settings-save">
          <button type="submit" className="research-button" disabled={!stored}>
            Save automatic updates
          </button>
        </div>
      </form>
    </section>
  );
}
