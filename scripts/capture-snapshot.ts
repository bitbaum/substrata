/** Operator-run after deployment. Fetch, verify, and retain an immutable analysis snapshot. */
import { createHash } from 'node:crypto';
import { database } from '../lib/db';
async function main() {
  const response = await fetch('https://substrata.orangecat.ch/api/research/export', {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Export returned ${response.status}`);
  const snapshot = await response.json();
  const digest = createHash('sha256').update(JSON.stringify(snapshot.data)).digest('hex');
  if (snapshot.schemaVersion !== 1 || digest !== snapshot.sha256)
    throw new Error('Snapshot schema or digest mismatch');
  await database().query(
    'INSERT INTO research_snapshots(sha256,schema_version,data) VALUES($1,$2,$3) ON CONFLICT(sha256) DO NOTHING',
    [digest, snapshot.schemaVersion, JSON.stringify(snapshot.data)],
  );
  console.log(`Verified and retained snapshot ${digest}`);
  await database().end();
}
main().catch(() => {
  console.error('Snapshot capture failed');
  process.exitCode = 1;
});
