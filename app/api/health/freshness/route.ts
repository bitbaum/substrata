import { freshnessReport } from '@/lib/freshness/read';

export const dynamic = 'force-dynamic';

/**
 * Every feed, dataset and queue with its state — the machine face of
 * /data/freshness. Returns 200 with the full report (ok: false when something
 * is stale or failing, so the footer badge and readers see what needs attention
 * without failing as an HTTP service-unavailable error on page views); "late"
 * and "not scheduled" are reported in the body and do not fail ok.
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
        unconfirmed: d.dataset.unconfirmed ?? [],
      })),
      reviewQueue: report.queue,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
