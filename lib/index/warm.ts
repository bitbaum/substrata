/**
 * Build the chunk index once, off the request path, when the server starts.
 *
 * `buildChunks()` costs about 5 s on a cold process (most of it the pure
 * quality checks the `quality` facet reads). Unwarmed, that cost landed on the
 * first reader to Ask after every deploy, because `search_corpus` runs inside
 * Ask. `instrumentation.ts` calls this at startup; it returns at once and the
 * build runs on a later turn of the event loop. A failure is logged and
 * forgotten: the index then builds lazily on first use, as it did before.
 */
import { buildChunks } from './build';

export function warmIndex(
  build: () => unknown = buildChunks,
  later: (run: () => void) => unknown = setImmediate,
  log: (message: string, error: unknown) => void = (m, e) => console.error(m, e),
): void {
  later(() => {
    try {
      build();
    } catch (error) {
      log('[index] warming the chunk index failed; it will build on first use', error);
    }
  });
}
