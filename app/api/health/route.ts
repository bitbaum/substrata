import { coverageProgress } from '@/config/substrata-coverage';
import { evidenceProgress } from '@/config/substrata-evidence';

/**
 * Liveness plus the one number that says whether the research is moving.
 * The deploy pipeline reads the status; a person reads the meter.
 */
export function GET() {
  const coverage = coverageProgress();
  const evidence = evidenceProgress();
  return Response.json({
    ok: true,
    service: 'substrata',
    producers: {
      total: coverage.total,
      sourced: coverage.sourced,
      withCandidate: evidence.candidates,
    },
  });
}
