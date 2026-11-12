import { defaultProviders, webSearch } from '@bitbaum/ai-kit/web';
import { searchNote } from '@/lib/search-note';

export const dynamic = 'force-dynamic';

/** One probe per this long, whoever asks: a health check must not spend a search per visit. */
const PROBE_EVERY_MS = 10 * 60_000;
/** A fixed question the corpus is about, so an empty answer means the backend, not the words. */
const PROBE_QUERY = 'helium supply';

type Probe = Record<string, unknown>;
let last: { at: number; body: Probe } | null = null;
/** The probe running now, shared: concurrent requests wait for one search, never start their own. */
let inflight: Promise<Probe> | null = null;

async function probe(): Promise<Probe> {
  const backends = defaultProviders(process.env).map((p) => p.name);
  const search = await webSearch(PROBE_QUERY, { limit: 3, timeoutMs: 8000, lang: 'en' });
  const body = {
    ok: search.status === 'found',
    status: search.status,
    backends,
    attempts: searchNote(search),
    checkedAt: new Date().toISOString(),
  };
  last = { at: Date.now(), body };
  return body;
}

/**
 * Whether the open web can be searched from this deployment right now — the
 * one dependency the Ask assistant's web answers, the event sweep and producer
 * sourcing share (`@bitbaum/ai-kit/web`). Reports which backends are
 * configured (names only, never a URL or key), what each did on one fixed
 * search, and when that was. At most one search per ten minutes, whoever asks
 * and however many ask at once: a stale report is served while a fresh one
 * runs.
 *
 * `status` is ai-kit's three-valued answer: `found`, `nothing` (a backend
 * answered, empty) or `could_not_look` (no backend answered). 200 either way:
 * this is a report, not a gate.
 */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (last && Date.now() - last.at < PROBE_EVERY_MS)
    return Response.json({ ...last.body, cached: true }, { headers });
  const running = inflight !== null;
  inflight ??= probe().finally(() => {
    inflight = null;
  });
  // While a refresh runs, a caller with a report to read gets that report now.
  if (running && last) return Response.json({ ...last.body, cached: true }, { headers });
  const body = await inflight;
  return Response.json({ ...body, cached: running }, { headers });
}
