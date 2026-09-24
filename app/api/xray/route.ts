/**
 * The X-ray, computed in the request and forgotten.
 *
 * Holdings arrive in a POST body — never a query string, because the proxy's
 * access log records URLs — are analysed in memory, and are not written to the
 * database, a log line or a cache. The only database touches are reads: the
 * SEC filings already fetched for the rails, and the per-IP rate limit, which
 * stores a keyed hash of the address and nothing about the request.
 */
import { xrayPortfolio } from '@/lib/xray/portfolio';
import { MAX_INPUT_CHARS } from '@/lib/xray/parse';
import { registrantsOn, filingItems } from '@/lib/desk-filings';
import { filingsFor } from '@/lib/filings-store';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const FILING_DAYS = 45;

async function recentFilings(rails: Set<string>) {
  try {
    const registrants = registrantsOn(rails);
    if (registrants.size === 0) return [];
    const filings = await filingsFor([...registrants.keys()], FILING_DAYS);
    return filingItems(filings, registrants)
      .slice(0, 40)
      .map((f) => ({
        title: f.title,
        url: f.url,
        at: f.at,
        form: 'form' in f ? (f.form ?? null) : null,
        bottlenecks: f.bottlenecks,
      }));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'Origin not allowed' }, { status: 403, headers: NO_STORE });
  try {
    if (!(await allowRequest(request, 'xray', 120)))
      return Response.json(
        { error: 'Too many X-rays this hour. Try again later.' },
        { status: 429, headers: NO_STORE },
      );
  } catch {
    // The limiter is a guard, not a dependency: without its table the X-ray still runs.
  }
  let text: string;
  try {
    const body = (await boundedJson(request)) as { text?: unknown };
    if (typeof body.text !== 'string') throw new Error('no text');
    text = body.text.slice(0, MAX_INPUT_CHARS);
  } catch {
    return Response.json(
      { error: 'Send holdings as text, one per line (up to about 20 KB).' },
      { status: 400, headers: NO_STORE },
    );
  }
  const result = xrayPortfolio(text);
  const filings = await recentFilings(new Set(result.rails.map((r) => r.bottleneck)));
  return Response.json({ ...result, filings, filingDays: FILING_DAYS }, { headers: NO_STORE });
}
