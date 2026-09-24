import { currentSession } from '@/lib/auth';
import { readFollows } from '@/lib/desk-store';
import { railsOf } from '@/lib/follows';
import { exposureRows, toCsv } from '@/lib/exposure';
import { parseExposureQuery, selectRows } from '@/lib/exposure-query';

export const dynamic = 'force-dynamic';

/** The exposure table as CSV: the same rows, filters and order as /exposure. */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = parseExposureQuery(params);
  const session = query.mine ? await currentSession() : null;
  const rails = session?.actorId
    ? new Set(railsOf(await readFollows(session.actorId)).map((b) => b.name))
    : null;
  const today = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(selectRows(exposureRows(), query, rails)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="substrata-exposure-${today}.csv"`,
    },
  });
}
