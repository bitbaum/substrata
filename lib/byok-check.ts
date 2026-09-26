/**
 * The server's check of a reader's key: ask the vendor, then apply the one
 * admission rule (`lib/byok-admit.ts`).
 *
 * The probe is `@bitbaum/ai-kit/byok-probe`: it checks OpenRouter at `/key`
 * (its `/models` is public and says 200 to a dead key), reports a refusal in
 * the vendor's own words with the key redacted, and ranks the models the key
 * can use. Never trust a browser's "it worked" — a key is probed again here
 * before it is sealed, because a saved key that does not work is a question
 * that fails later with nobody knowing why.
 */
import { probeByokKey } from '@bitbaum/ai-kit/byok-probe';
import { admitKey, type Admission, type KeyCheck } from './byok-admit';

export type Probe = (
  vendor: string,
  apiKey: string,
) => Promise<KeyCheck & { status: number | null }>;

/** Ask the vendor, then admit — or not. The probe is injectable for tests only. */
export async function vetKey(
  vendor: string,
  apiKey: string,
  model: string,
  probe: Probe = probeByokKey,
): Promise<Admission & { status: number | null }> {
  const check = await probe(vendor, apiKey);
  return { ...admitKey(check, model), status: check.status };
}
