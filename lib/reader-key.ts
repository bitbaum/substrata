/**
 * The reader's own key for one request: from the body (held in their
 * browser), or — signed in, `byokStored: true` — opened from the vault.
 * Shared by Ask and "Summarise with AI", so the two cannot disagree about
 * whose key a request carries. The key never leaves this request.
 */
import { currentSession } from './auth';
import { byokFromBody, type ByokConfig } from './byok';
import { openStoredKey } from './byok-vault';

export type ReaderKey = { key: ByokConfig } | { key: null } | { error: string };

export async function readerKey(input: unknown): Promise<ReaderKey> {
  const parsed = byokFromBody((input as { byok?: unknown } | null)?.byok);
  if (parsed === 'invalid') return { error: 'Invalid key configuration.' };
  if (parsed) return { key: parsed };
  if ((input as { byokStored?: unknown } | null)?.byokStored !== true) return { key: null };
  const session = await currentSession();
  const stored = session?.actorId ? await openStoredKey(session.actorId).catch(() => null) : null;
  return stored
    ? { key: stored }
    : { error: 'Your saved key could not be opened. Add it again in AI settings.' };
}
