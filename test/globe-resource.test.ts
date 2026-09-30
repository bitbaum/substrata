import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fetchWorldTopology } from '../components/portal/globe-resource';

const manifestText = readFileSync('public/geo/manifest.json', 'utf8');
const mapText = readFileSync('public/geo/countries-50m.json', 'utf8');
const options = { baseUrl: 'https://example.test', asOf: '2026-09-30' };

test('the globe fetches only its manifest and declared world resource, then verifies the topology', async () => {
  const requests: string[] = [];
  const topology = await fetchWorldTopology({
    ...options,
    fetcher: async (url, init) => {
      requests.push(new URL(String(url)).pathname);
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.redirect, 'error');
      return new Response(requests.length === 1 ? manifestText : mapText);
    },
  });
  assert.deepEqual(requests, ['/geo/manifest.json', '/geo/countries-50m.json']);
  assert.equal(topology.objects.countries.geometries.length, 241);
});

test('the globe rejects an invalid manifest before downloading geometry', async () => {
  let requests = 0;
  const badManifest = JSON.parse(manifestText);
  badManifest.sources[0].licenseSPDX = 'Unaccepted';
  await assert.rejects(
    fetchWorldTopology({
      ...options,
      fetcher: async () => {
        requests += 1;
        return new Response(JSON.stringify(badManifest));
      },
    }),
    { code: 'invalid_manifest' },
  );
  assert.equal(requests, 1);
});

test('a failed download can be retried without weakening the integrity check', async () => {
  const fetcher: typeof fetch = async (url) =>
    new Response(String(url).endsWith('/manifest.json') ? manifestText : mapText);
  await assert.rejects(
    fetchWorldTopology({
      ...options,
      fetcher: async () => new Response('Unavailable', { status: 503 }),
    }),
    { code: 'resource_fetch_failed' },
  );
  assert.equal((await fetchWorldTopology({ ...options, fetcher })).type, 'Topology');
  await assert.rejects(
    fetchWorldTopology({
      ...options,
      fetcher: async (url) =>
        new Response(
          String(url).endsWith('/manifest.json')
            ? manifestText
            : mapText.replace('Afghanistan', 'Xfghanistan'),
        ),
    }),
    { code: 'invalid_resource' },
  );
});
