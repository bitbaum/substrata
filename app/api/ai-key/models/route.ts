import { fetchCatalog } from '@bitbaum/ai-kit';
import { currentSession } from '@/lib/auth';
import { byokVendor } from '@/lib/byok';
import { openStoredKey } from '@/lib/byok-vault';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

/**
 * The models a reader's key can reach, read live from that vendor's own
 * catalogue — so the picker never offers an id the vendor retired, and a
 * wrong key is caught here rather than on the first question.
 *
 * The host is the vendor's, from the shared closed list; the key is the one
 * in the body, or (signed in, `stored: true`) the sealed one. It is used for
 * this one request and not kept.
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
    typeof input.apiKey === 'string' && input.apiKey.length <= 400 && !/\s/.test(input.apiKey)
      ? input.apiKey
      : undefined;
  try {
    if (!(await allowRequest(request, 'ai-models', 30)))
      return Response.json({ error: 'Too many lookups. Try again later.' }, { status: 429 });
    if (input.stored === true) {
      const session = await currentSession();
      const saved = session?.actorId ? await openStoredKey(session.actorId) : null;
      if (!saved) return Response.json({ error: 'No saved key.' }, { status: 404 });
      vendor = byokVendor(saved.vendor);
      apiKey = saved.apiKey;
    }
    if (!vendor || !apiKey || apiKey.length < 8)
      return Response.json({ error: 'Choose a provider and paste a key.' }, { status: 400 });
    const catalogue = await fetchCatalog(vendor.baseUrl, apiKey, { timeoutMs: 10_000 });
    if (!catalogue)
      return Response.json(
        { error: `${vendor.label} did not accept that key (or did not answer).` },
        { status: 422 },
      );
    const models = catalogue
      .filter((m) => !m.outputModalities || m.outputModalities.includes('text'))
      .map((m) => ({ id: m.id, tools: m.tools, free: m.costsNothing }))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 500);
    return Response.json({ vendor: vendor.id, models });
  } catch {
    return Response.json({ error: 'Could not reach the provider.' }, { status: 503 });
  }
}
