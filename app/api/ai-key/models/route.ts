import { probeByokKey } from '@bitbaum/ai-kit/byok-probe';
import { currentSession } from '@/lib/auth';
import { byokVendor } from '@/lib/byok';
import { openStoredKey } from '@/lib/byok-vault';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

/**
 * "Does this key work, and what can it use?" — asked the moment a reader
 * pastes a key, signed in or not. Nothing is stored.
 *
 * `@bitbaum/ai-kit/byok-probe` answers it: the key is checked where the
 * vendor actually checks keys (OpenRouter's `/models` is public and says 200
 * to a dead key, so it is `/key` there), a refusal comes back in the vendor's
 * own words with the key redacted, and the models are the ones this key can
 * use, strongest first. A refusal is a 200 with `ok: false` — it is an answer
 * for the reader, not a failure of this route.
 *
 * The host is the vendor's, from the shared closed list; the key is the one
 * in the body, or (signed in, `stored: true`) the sealed one.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  let input: { vendor?: unknown; apiKey?: unknown; stored?: unknown };
  try {
    input = (await boundedJson(request)) as typeof input;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  let vendor = typeof input.vendor === 'string' ? byokVendor(input.vendor) : undefined;
  let apiKey =
    typeof input.apiKey === 'string' && input.apiKey.length <= 400
      ? input.apiKey.trim()
      : undefined;
  try {
    if (!(await allowRequest(request, 'ai-models', 30)))
      return Response.json(
        { error: 'Too many checks — wait a few minutes and try again.' },
        { status: 429 },
      );
    if (input.stored === true) {
      const session = await currentSession();
      const saved = session?.actorId ? await openStoredKey(session.actorId) : null;
      if (!saved)
        return Response.json({ error: 'No saved key — paste it again.' }, { status: 404 });
      vendor = byokVendor(saved.vendor);
      apiKey = saved.apiKey;
    }
    if (!vendor || !apiKey || apiKey.length < 8)
      return Response.json({ error: 'Choose a provider and paste a key.' }, { status: 400 });
    const probe = await probeByokKey(vendor.id, apiKey, { timeoutMs: 10_000 });
    return Response.json({
      vendor: vendor.id,
      ok: probe.ok,
      message: probe.message,
      models: probe.models.slice(0, 500),
      suggested: probe.suggested,
    });
  } catch {
    return Response.json({ error: 'Could not reach the provider.' }, { status: 503 });
  }
}
