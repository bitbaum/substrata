'use client';

/** Evidence for the private inbox. A different action from asking, so its own form. */
export function ContributeForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form onSubmit={onSubmit} className="inquire-form companion-inbox">
      <label htmlFor="contrib-message">What should the research team know?</label>
      <textarea id="contrib-message" name="message" required minLength={10} rows={4} />
      <label htmlFor="contrib-email">Reply email (optional)</label>
      <input id="contrib-email" name="replyTo" type="email" />
      <label htmlFor="contrib-credit">Credit name (optional)</label>
      <input id="contrib-credit" name="creditName" maxLength={120} />
      <label className="consent-line">
        <input type="checkbox" name="consent" required />
        Send this to the private inbox. It does not publish.
      </label>
      <button type="submit" className="research-button" disabled={busy}>
        Send
      </button>
    </form>
  );
}
