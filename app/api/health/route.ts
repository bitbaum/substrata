import { portalTotals } from '@/lib/bottlenecks';
import { database } from '@/lib/db';
import { authEnabled } from '@/lib/auth';
import { freeChain, usableChain } from '@bitbaum/ai-kit';
export const dynamic = 'force-dynamic';

/**
 * Liveness plus the one number that says whether the research is moving.
 * The deploy pipeline reads the status; a person reads the meter.
 */
export async function GET() {
  const totals = portalTotals();
  let databaseReady = false;
  try {
    await database().query(
      'SELECT 1 FROM research_preferences, research_contributions, research_rate_limits, research_snapshots LIMIT 0',
    );
    databaseReady = true;
  } catch {
    databaseReady = false;
  }
  const aiConfigured = usableChain(freeChain('SUBSTRATA'), process.env).length > 0;
  const ok = databaseReady && authEnabled && aiConfigured;
  return Response.json(
    {
      ok,
      service: 'substrata',
      database: databaseReady ? 'ready' : 'unavailable',
      accounts: authEnabled ? 'configured' : 'unavailable',
      ai: aiConfigured ? 'configured; request required to verify availability' : 'unavailable',
      producers: {
        total: totals.producers,
        sourced: totals.sourced,
        withCandidate: totals.candidates,
      },
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
