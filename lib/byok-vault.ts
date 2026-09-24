/**
 * A signed-in reader's key, sealed in this app's database.
 *
 * Sealed with `@bitbaum/ai-kit/seal` (AES-256-GCM) under
 * `SUBSTRATA_BYOK_SECRET`, which lives only in the box's runtime env — so a
 * database dump alone reveals no key. Without that secret the vault reports
 * itself off and the settings UI offers browser-only storage instead of
 * pretending to save.
 */
import { byokKeyHint, isByokConfig, type ByokConfig } from '@bitbaum/ai-kit/byok';
import { openSecret, sealSecret } from '@bitbaum/ai-kit/seal';
import { database } from './db';

export interface StoredKey {
  vendor: ByokConfig['vendor'];
  model: string;
  hint: string;
  updatedAt: string;
}

function secret(): string | undefined {
  const value = process.env.SUBSTRATA_BYOK_SECRET?.trim();
  return value && value.length >= 16 ? value : undefined;
}

export function vaultEnabled(): boolean {
  return Boolean(secret() && process.env.DATABASE_URL);
}

/** What is saved, without the key. Null when nothing is (or the vault is off). */
export async function storedKey(actorId: string): Promise<StoredKey | null> {
  if (!vaultEnabled()) return null;
  const { rows } = await database().query<{
    vendor: string;
    model: string;
    key_hint: string;
    updated_at: Date;
  }>('SELECT vendor, model, key_hint, updated_at FROM research_ai_keys WHERE actor_id=$1', [
    actorId,
  ]);
  const row = rows[0];
  if (!row) return null;
  return {
    vendor: row.vendor as StoredKey['vendor'],
    model: row.model,
    hint: row.key_hint,
    updatedAt: row.updated_at.toISOString(),
  };
}

/** The usable config, for one request. Null if absent, unsealable, or no longer valid. */
export async function openStoredKey(actorId: string): Promise<ByokConfig | null> {
  const key = secret();
  if (!key || !process.env.DATABASE_URL) return null;
  const { rows } = await database().query<{ vendor: string; model: string; sealed: string }>(
    'SELECT vendor, model, sealed FROM research_ai_keys WHERE actor_id=$1',
    [actorId],
  );
  const row = rows[0];
  if (!row) return null;
  try {
    const config = { vendor: row.vendor, model: row.model, apiKey: openSecret(row.sealed, key) };
    return isByokConfig(config) ? config : null;
  } catch {
    // Sealed under a secret that has since rotated: unusable, and the reader
    // is asked to save it again rather than shown a decryption error.
    return null;
  }
}

export async function saveStoredKey(actorId: string, config: ByokConfig): Promise<void> {
  const key = secret();
  if (!key) throw new Error('Key storage is not configured.');
  await database().query(
    `INSERT INTO research_ai_keys(actor_id, vendor, model, sealed, key_hint, updated_at)
     VALUES($1,$2,$3,$4,$5,now())
     ON CONFLICT(actor_id) DO UPDATE SET vendor=$2, model=$3, sealed=$4, key_hint=$5, updated_at=now()`,
    [
      actorId,
      config.vendor,
      config.model,
      sealSecret(config.apiKey, key),
      byokKeyHint(config.apiKey),
    ],
  );
}

/** Change only the model, keeping the sealed key. */
export async function setStoredModel(actorId: string, model: string): Promise<boolean> {
  if (!vaultEnabled()) return false;
  const result = await database().query(
    'UPDATE research_ai_keys SET model=$2, updated_at=now() WHERE actor_id=$1',
    [actorId, model],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteStoredKey(actorId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await database().query('DELETE FROM research_ai_keys WHERE actor_id=$1', [actorId]);
}
