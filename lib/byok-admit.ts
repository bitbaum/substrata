/**
 * May this key and model be used? One rule for every place a reader's key is
 * kept — sealed on the account (the server decides) or held in the browser
 * (the panel decides, since nothing is sent anywhere to store it).
 *
 * Pure and dependency-free so the browser bundle and the routes import the
 * same function: two copies of "is this key good enough to save" would drift,
 * and the one that drifted would save a dead key.
 */

/** What a check of a key against its vendor said (ai-kit's `ByokProbe`, minus the status). */
export interface KeyCheck {
  ok: boolean;
  /** One sentence for the reader; on failure, the vendor's own words when it sent any. */
  message: string;
  /** Model ids this key can use, best first. Empty when the vendor gave no list. */
  models: string[];
  /** The strongest chat model the key can use, or null. */
  suggested: string | null;
}

export type Admission = { ok: true; model: string } | { ok: false; error: string };

const MODEL_MAX = 200;

/**
 * A key is admitted only after a check that passed, and only with a model
 * that check listed. When the vendor published no list, the reader's typed
 * id is accepted — there is nothing to hold it against.
 */
export function admitKey(check: KeyCheck | null | undefined, model: string): Admission {
  if (!check) return { ok: false, error: 'Check the key with its provider first.' };
  if (!check.ok) return { ok: false, error: check.message || 'The provider did not accept it.' };
  const id = model.trim();
  if (!id) return { ok: false, error: 'Choose a model.' };
  if (id.length > MODEL_MAX || /[\r\n]/.test(id)) return { ok: false, error: 'Choose a model.' };
  if (check.models.length > 0 && !check.models.includes(id))
    return { ok: false, error: `Your key can't use ${id}. Pick one from the list.` };
  return { ok: true, model: id };
}
