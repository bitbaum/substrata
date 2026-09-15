import { createHmac } from 'node:crypto';
import { database } from './db';

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin || origin === process.env.AUTH_URL;
}
/** Atomic, cross-process throttle; raw IPs are never stored. Proxy must overwrite X-Forwarded-For. */
export async function allowRequest(request: Request, lane: string, limit: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('Request guard not configured');
  const ip = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? 'unknown';
  const key = createHmac('sha256', secret).update(`${lane}:${ip}`).digest('hex');
  const result = await database().query<{ hits: number }>(
    `INSERT INTO research_rate_limits(key,window_start,hits) VALUES($1,now(),1)
 ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN research_rate_limits.window_start < now()-interval '1 hour' THEN 1 ELSE research_rate_limits.hits+1 END,
 window_start=CASE WHEN research_rate_limits.window_start < now()-interval '1 hour' THEN now() ELSE research_rate_limits.window_start END RETURNING hits`,
    [key],
  );
  return result.rows[0].hits <= limit;
}
export async function boundedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 20000) {
      await reader.cancel();
      throw new Error('Body too large');
    }
    parts.push(value);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;
}
