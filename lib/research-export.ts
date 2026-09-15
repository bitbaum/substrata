import { createHash } from 'node:crypto';
import { buildMap } from './map';
import { BOTTLENECKS } from './bottlenecks';
import { SCIENCE } from '@/config/substrata-science';
import { INSTRUMENTS } from '@/config/substrata-policy';

export function researchExport() {
  const { generatedAt, ...map } = buildMap();
  const data = {
    ...map,
    science: SCIENCE,
    policy: INSTRUMENTS,
    assessments: BOTTLENECKS.map((b) => ({
      slug: b.slug,
      plain: b.plain,
      rationale: b.rationale,
      judgedOn: b.judgedOn,
      score: b.score,
    })),
  };
  return {
    schemaVersion: 1,
    generatedAt,
    sha256: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    digestEncoding: 'SHA-256 of UTF-8 JSON.stringify(data)',
    data,
  };
}

/** RFC4180 quoting, with spreadsheet formula neutralisation for exported text. */
export function csvCell(value: string | number): string {
  const raw = String(value);
  const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function bottlenecksCsv() {
  return [
    ['slug', 'name', 'stage', 'evidence', 'analyst_score_out_of_12', 'judged_on', 'rationale'],
    ...BOTTLENECKS.map((b) => [
      b.slug,
      b.name,
      b.stage,
      b.state,
      b.binding,
      b.judgedOn,
      b.rationale,
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}
