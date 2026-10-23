/**
 * Runs once when a Next.js server starts (see node_modules/next/dist/docs/
 * 01-app/02-guides/instrumentation.md). `register` must finish before the
 * server takes requests, so nothing here is awaited: work is kicked off and
 * left to run.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Warm the retrieval index so the first Ask after a deploy does not pay for it.
  import('./lib/index/warm')
    .then(({ warmIndex }) => warmIndex())
    .catch((error) => console.error('[index] could not load the index warmer', error));
}
