/**
 * Recorded source responses (test/fixtures/sources/manifest.json: URL → file
 * as served, some as noted excerpts) behind a `fetch` the adapters accept, so
 * the tests read real bytes and never the network. Any URL not recorded
 * answers 404, as an absent GLEIF parent does.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { DocumentDeps } from '../lib/sources/document';

const DIR = path.join(import.meta.dirname, 'fixtures', 'sources');

const MANIFEST = JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8')) as Record<
  string,
  { file: string; contentType: string }
>;

export function fixtureBytes(file: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(DIR, file)));
}

export function fixtureText(file: string): string {
  return readFileSync(path.join(DIR, file), 'utf8');
}

/** URLs asked for, in order, so a test can assert what an adapter fetched. */
export const asked: string[] = [];

export const fixtureFetch: typeof globalThis.fetch = async (input) => {
  const url = String(input instanceof Request ? input.url : input);
  asked.push(url);
  const hit = MANIFEST[url];
  if (!hit) return new Response('not recorded', { status: 404 });
  return new Response(fixtureBytes(hit.file) as Uint8Array<ArrayBuffer>, {
    status: 200,
    headers: { 'content-type': hit.contentType },
  });
};

/** Deps for any adapter: recorded responses, no cache, no waiting. */
export const offline: DocumentDeps = { fetch: fixtureFetch, cacheDir: null, sleep: async () => {} };

export const manifestUrls = (): string[] => Object.keys(MANIFEST);
