import { portalTotals } from '@/lib/bottlenecks';

/**
 * Liveness plus the one number that says whether the research is moving.
 * The deploy pipeline reads the status; a person reads the meter.
 */
export function GET() {
  const totals = portalTotals();
  return Response.json({
    ok: true,
    service: 'substrata',
    producers: {
      total: totals.producers,
      sourced: totals.sourced,
      withCandidate: totals.candidates,
    },
  });
}
