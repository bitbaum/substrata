import { currentSession } from '@/lib/auth';
import { isByokConfig } from '@/lib/byok';
import { vetKey } from '@/lib/byok-check';
import {
  deleteStoredKey,
  openStoredKey,
  saveStoredKey,
  setStoredModel,
  storedKey,
  vaultEnabled,
} from '@/lib/byok-vault';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

/**
 * A signed-in reader's saved AI key: what is saved (never the key itself),
 * save, change the model, remove. Signed out, this says so and the UI keeps
 * the key in the browser instead.
 *
 * Saving and changing the model both ask the vendor again (`vetKey`) before
 * anything is written: a dead key is never sealed, and a model the key cannot
 * use is never stored — whatever the browser claimed its check said.
 */
export async function GET() {
  const session = await currentSession();
  if (!session?.actorId) return Response.json({ signedIn: false, canStore: false, stored: null });
  try {
    const stored = await storedKey(session.actorId);
    return Response.json({ signedIn: true, canStore: vaultEnabled(), stored });
  } catch {
    return Response.json({ signedIn: true, canStore: false, stored: null });
  }
}

async function guarded(request: Request) {
  if (!sameOrigin(request))
    return { error: Response.json({ error: 'Origin not allowed' }, { status: 403 }) };
  const session = await currentSession();
  if (!session?.actorId)
    return { error: Response.json({ error: 'Sign in to save a key.' }, { status: 401 }) };
  return { actorId: session.actorId };
}

export async function PUT(request: Request) {
  const g = await guarded(request);
  if ('error' in g) return g.error;
  if (!vaultEnabled())
    return Response.json({ error: 'Key storage is not configured here.' }, { status: 503 });
  let input: unknown;
  try {
    input = await boundedJson(request);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!isByokConfig(input))
    return Response.json({ error: 'Choose a provider, a key and a model.' }, { status: 400 });
  try {
    if (!(await allowRequest(request, 'ai-key', 20)))
      return Response.json({ error: 'Too many changes. Try again later.' }, { status: 429 });
    const vetted = await vetKey(input.vendor, input.apiKey, input.model);
    if (!vetted.ok) return Response.json({ error: vetted.error }, { status: 422 });
    await saveStoredKey(g.actorId, {
      vendor: input.vendor,
      apiKey: input.apiKey,
      model: vetted.model,
    });
    return Response.json({ stored: await storedKey(g.actorId) });
  } catch {
    return Response.json({ error: 'Could not save the key.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const g = await guarded(request);
  if ('error' in g) return g.error;
  let model: unknown;
  try {
    model = ((await boundedJson(request)) as { model?: unknown })?.model;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (typeof model !== 'string' || !model.trim() || model.length > 200 || /[\r\n]/.test(model))
    return Response.json({ error: 'Choose a model.' }, { status: 400 });
  try {
    if (!(await allowRequest(request, 'ai-key', 20)))
      return Response.json({ error: 'Too many changes. Try again later.' }, { status: 429 });
    const saved = await openStoredKey(g.actorId);
    if (!saved) return Response.json({ error: 'No saved key to change.' }, { status: 404 });
    const vetted = await vetKey(saved.vendor, saved.apiKey, model);
    if (!vetted.ok) return Response.json({ error: vetted.error }, { status: 422 });
    if (!(await setStoredModel(g.actorId, vetted.model)))
      return Response.json({ error: 'No saved key to change.' }, { status: 404 });
    return Response.json({ stored: await storedKey(g.actorId) });
  } catch {
    return Response.json({ error: 'Could not change the model.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const g = await guarded(request);
  if ('error' in g) return g.error;
  try {
    await deleteStoredKey(g.actorId);
    return Response.json({ stored: null });
  } catch {
    return Response.json({ error: 'Could not remove the key.' }, { status: 503 });
  }
}
