/**
 * Facet `series`: each dated series as its latest value, the one before it and
 * the change. Committed series carry their points; the official (BLS) series
 * are fetched into the database on a schedule, so in-process they are indexed
 * by what they measure, and the value is read from the series page or the tool.
 */
import { OFFICIAL_SERIES } from '@/config/substrata-official-series';
import { seriesHref } from '../../links';
import {
  corpusSeries,
  formatPct,
  formatPoint,
  lastActual,
  periodLabel,
  type Series,
} from '../../series';
import { chunkId, makeChunk, type Chunk } from '../chunk';
import { bottleneckIdBySlug } from './ids';

function corpusChunk(s: Series): Chunk {
  const latest = lastActual(s);
  const at = latest ? s.points.indexOf(latest) : -1;
  const prior = at > 0 ? s.points[at - 1] : undefined;
  const pct =
    latest && prior && prior.value !== 0
      ? (latest.value - prior.value) / Math.abs(prior.value)
      : undefined;
  const text = [
    `${s.metric} (${s.geography}):`,
    latest
      ? `latest ${formatPoint(latest)} ${s.unit} (${periodLabel(latest.date)})`
      : 'no actual value yet',
    prior ? `; prior ${formatPoint(prior)} ${s.unit} (${periodLabel(prior.date)})` : '',
    pct !== undefined ? `; change ${formatPct(pct)}` : '',
    s.describes ? `. Counts: ${s.describes}` : '',
    latest ? `. Source: ${latest.publisher}.` : '.',
  ].join('');
  return makeChunk({
    id: chunkId('series', s.id),
    facet: 'series',
    entityIds: bottleneckIdBySlug(s.bottleneck),
    title: s.metric,
    text,
    href: seriesHref(s.id),
    ...(latest ? { sourceUrl: latest.source, asOf: latest.date } : {}),
    evidence: 'sourced',
    significance: 0.5,
  });
}

export function seriesChunks(): Chunk[] {
  const official = OFFICIAL_SERIES.map((s) =>
    makeChunk({
      id: chunkId('series', s.id),
      facet: 'series',
      entityIds: bottleneckIdBySlug(s.bottleneck),
      title: s.metric,
      text: `${s.metric} (${s.geography}, ${s.unit}), published by the ${s.agency} as series ${s.agencyId} and fetched on a schedule. Counts: ${s.describes}. The latest value is on the series page.`,
      href: seriesHref(s.id),
      evidence: 'sourced',
      significance: 0.5,
    }),
  );
  return [...corpusSeries().map(corpusChunk), ...official];
}
