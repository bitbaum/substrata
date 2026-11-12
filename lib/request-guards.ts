import { createHmac } from 'node:crypto';
import { database } from './db';

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin || origin === process.env.AUTH_URL;
}
/** Atomic, cross-process throttle; raw IPs are never stored. Proxy must overwrite X-Forwarded-For. */
/**
 * At most `limit` requests per IP per lane in a window of `windowHours` (one
 * hour unless said otherwise). A lane's window is fixed by its first caller:
 * give an hourly and a daily limit different lane names.
 */
export async function allowRequest(request: Request, lane: string, limit: number, windowHours = 1) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('Request guard not configured');
  const ip = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? 'unknown';
  const key = createHmac('sha256', secret).update(`${lane}:${ip}`).digest('hex');
  try {
    const result = await database().query<{ hits: number }>(
      `INSERT INTO research_rate_limits(key,window_start,hits) VALUES($1,now(),1)
 ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN research_rate_limits.window_start < now()-($2::float8 * interval '1 hour') THEN 1 ELSE research_rate_limits.hits+1 END,
 window_start=CASE WHEN research_rate_limits.window_start < now()-($2::float8 * interval '1 hour') THEN now() ELSE research_rate_limits.window_start END RETURNING hits`,
      [key, windowHours],
    );
    return result.rows[0].hits <= limit;
  } catch (error) {
    // The database is the counter, not the service. On 2026-11-12 the box's
    // Postgres ran out of connections and every question was answered "the
    // assistant is temporarily unavailable", though nothing the answer needs
    // was down. The limit still holds while it is away, counted in this process.
    console.error('rate limit store unavailable', error instanceof Error ? error.name : 'unknown');
    return allowLocally(key, limit, windowHours);
  }
}

const local = new Map<string, { start: number; hits: number }>();
/** Keys held at most; past it the oldest go, so an outage cannot grow the map without bound. */
const LOCAL_KEYS = 5000;

/** The same fixed window as the table, held in this process: for when the table cannot be reached. */
export function allowLocally(key: string, limit: number, windowHours = 1, now = Date.now()) {
  const entry = local.get(key);
  if (!entry || entry.start < now - windowHours * 3_600_000) {
    if (local.size >= LOCAL_KEYS) local.delete(local.keys().next().value!);
    local.delete(key);
    local.set(key, { start: now, hits: 1 });
    return 1 <= limit;
  }
  entry.hits += 1;
  return entry.hits <= limit;
}
export async function boundedJson(request: Request, maxBytes = 20000) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('Body too large');
    }
    parts.push(value);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;
}
