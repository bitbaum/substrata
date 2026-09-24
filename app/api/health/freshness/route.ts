import { freshnessReport } from '@/lib/freshness/read';

export const dynamic = 'force-dynamic';

/**
 * Every feed, dataset and queue with its state — the machine face of
 * /data/freshness. 200 when nothing is stale or failing, 503 when something
 * is, so an uptime monitor can page on it; "late" and "not scheduled" are in
 * the body but do not fail it.
 */
export async function GET() {
  const report = await freshnessReport();
  return Response.json(
    {
      ok: report.ok,
      state: report.state,
      checkedAt: report.checkedAt,
      attention: report.attention,
      feeds: report.feeds.map((f) => ({
        id: f.feed.id,
        label: f.feed.label,
        state: f.state,
        everyHours: f.everyHours,
        lastOk: f.lastOk,
        lastFailure: f.lastFailure,
        runsThisWeek: f.runsThisWeek,
        note: f.note ?? null,
      })),
      datasets: report.datasets.map((d) => ({
        id: d.dataset.id,
        label: d.dataset.label,
        file: d.dataset.file,
        state: d.state,
        checkedOn: d.dataset.checkedOn,
        ageDays: d.ageDays,
        maxAgeDays: d.dataset.maxAgeDays,
      })),
      reviewQueue: report.queue,
    },
    { status: report.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
