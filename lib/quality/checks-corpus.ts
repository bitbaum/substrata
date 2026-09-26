/**
 * Pure checks on the hand-written corpus: producer rows, dependencies,
 * accepted events and claims. Each re-derives its answer from the committed
 * files, so `verify` runs them and the page shows them without a network.
 */
import claimsFile from '@/research/claims.json';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { DEPENDENCIES } from '@/config/substrata-dependencies';
import { EVENTS } from '@/config/substrata-events';
import { PARTICIPANTS } from '@/config/substrata-participants';
import { corpusSeries } from '@/lib/series';
import * as coverageModule from '@/config/substrata-coverage';
import * as taxonomyModule from '@/config/substrata-taxonomy';
import { bottleneckHref } from '@/lib/links';
import { judge, type CheckResult } from './types';

const BOTTLENECK_NAMES = new Set(BOTTLENECKS.map((b) => b.name));
const BOTTLENECK_SLUGS = new Set(BOTTLENECKS.map((b) => b.slug));
const COMPANY_NAMES = new Set(PARTICIPANTS.map((p) => p.name));
const isUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\/\S+$/.test(u);
const isDay = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

function producerChecks(): CheckResult[] {
  const rows = BOTTLENECKS.flatMap((b) => b.producers.map((p) => ({ b, p })));
  return [
    judge(
      {
        dataset: 'producers',
        criterion: 'completeness',
        check: 'producers/sourced-maker',
        label: 'Every bottleneck has at least one maker row with a primary source',
      },
      BOTTLENECKS,
      (b) =>
        b.producers.some((p) => !p.supplier && p.source)
          ? null
          : {
              row: b.name,
              problem:
                b.producers.length === 0
                  ? 'no producer or holder rows at all'
                  : `${b.producers.length} maker row(s), none sourced`,
              page: bottleneckHref(b.slug),
            },
    ),
    judge(
      {
        dataset: 'producers',
        criterion: 'provenance',
        check: 'producers/row-source',
        label: 'Every producer and holder row links a primary source',
      },
      rows,
      ({ b, p }) =>
        isUrl(p.source)
          ? null
          : {
              row: `${b.name}: ${p.name}`,
              problem: 'no source: an unverified lead',
              page: bottleneckHref(b.slug),
            },
    ),
    judge(
      {
        dataset: 'producers',
        criterion: 'provenance',
        check: 'producers/chokepoint-source',
        label: 'Every non-material chokepoint cites a primary source for why it binds',
      },
      coverageModule.CHOKEPOINTS,
      (c) =>
        isUrl(c.source)
          ? null
          : { row: c.name, problem: 'no source for the claim', page: bottleneckHref(c.name) },
    ),
  ];
}

function dependencyChecks(): CheckResult[] {
  const rows = DEPENDENCIES.map((d) => ({ d, row: `${d.from} ${d.kind} ${d.on}` }));
  return [
    judge(
      {
        dataset: 'dependencies',
        criterion: 'provenance',
        check: 'dependencies/source-quote-date',
        label: 'Every dependency has a source URL, a verbatim sentence and a read date',
      },
      rows,
      ({ d, row }) =>
        isUrl(d.source) && d.quote.trim().length >= 20 && isDay(d.readOn)
          ? null
          : { row, problem: 'source, quote or date missing', link: d.source },
    ),
    judge(
      {
        dataset: 'dependencies',
        criterion: 'consistency',
        check: 'dependencies/names-resolve',
        label: 'Both ends name an existing bottleneck or directory company',
      },
      rows,
      ({ d, row }) => {
        const fromOk =
          d.fromKind === 'bottleneck' ? BOTTLENECK_NAMES.has(d.from) : COMPANY_NAMES.has(d.from);
        return fromOk && BOTTLENECK_NAMES.has(d.on)
          ? null
          : { row, problem: 'an end does not resolve', link: d.source };
      },
    ),
    judge(
      {
        dataset: 'dependencies',
        criterion: 'completeness',
        check: 'dependencies/binding-now-joined',
        label: 'Every bottleneck binding now is joined to at least one dependent or input',
      },
      BOTTLENECKS.filter((b) => b.horizon === 'now'),
      (b) =>
        DEPENDENCIES.some((d) => d.on === b.name || d.from === b.name)
          ? null
          : { row: b.name, problem: 'no dependency row names it', page: bottleneckHref(b.slug) },
    ),
  ];
}

function eventChecks(): CheckResult[] {
  const rows = EVENTS.map((e) => ({ e, row: `${e.date} ${e.headline.slice(0, 70)}` }));
  return [
    judge(
      {
        dataset: 'events',
        criterion: 'provenance',
        check: 'events/source-quote-date',
        label:
          'Every accepted event has a source URL, a quoted sentence, its date and its acceptance date',
      },
      rows,
      ({ e, row }) =>
        isUrl(e.source) && e.quote.trim().length >= 20 && isDay(e.date) && isDay(e.acceptedOn)
          ? null
          : { row, problem: 'source, quote or a date missing', link: e.source },
    ),
    judge(
      {
        dataset: 'events',
        criterion: 'consistency',
        check: 'events/names-and-dates',
        label:
          'Events name existing bottlenecks and companies, and happened before they were accepted',
      },
      rows,
      ({ e, row }) => {
        const bad = [
          ...e.bottlenecks
            .filter((n) => !BOTTLENECK_NAMES.has(n))
            .map((n) => `unknown bottleneck "${n}"`),
          ...e.participants
            .filter((n) => !COMPANY_NAMES.has(n))
            .map((n) => `unknown company "${n}"`),
          ...(e.date > e.acceptedOn ? ['dated after it was accepted'] : []),
        ];
        return bad.length ? { row, problem: bad.join('; '), link: e.source } : null;
      },
    ),
  ];
}

/** Every string a module exports, joined: what its file says, without reading source (the build is standalone). */
function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsOf(v, out));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => stringsOf(v, out));
  return out;
}

const CLAIM_FILES: Record<string, unknown> = {
  'config/substrata-coverage.ts': coverageModule,
  'config/substrata-taxonomy.ts': taxonomyModule,
};

function claimChecks(): CheckResult[] {
  const seriesIds = new Set(corpusSeries().map((s) => s.id));
  const text = (file: string) => stringsOf(CLAIM_FILES[file]).join(' ').replace(/\s+/g, ' ');
  const claims = claimsFile.claims;
  return [
    judge(
      {
        dataset: 'claims',
        criterion: 'consistency',
        check: 'claims/series-agree',
        label:
          'Each claim still reads as checked in its file, on a real bottleneck, against series that exist',
      },
      claims,
      (c) => {
        const bad = [
          ...(text(c.file).includes(c.text.replace(/\s+/g, ' '))
            ? []
            : [`text no longer in ${c.file}`]),
          ...(BOTTLENECK_SLUGS.has(c.bottleneck) ? [] : ['unknown bottleneck']),
          ...c.series.filter((id) => !seriesIds.has(id)).map((id) => `unknown series ${id}`),
        ];
        return bad.length
          ? {
              row: `${c.bottleneck}: “${c.text.slice(0, 60)}”`,
              problem: bad.join('; '),
              page: bottleneckHref(c.bottleneck),
            }
          : null;
      },
    ),
    judge(
      {
        dataset: 'claims',
        criterion: 'provenance',
        check: 'claims/verdict-how',
        label: 'Each claim has a verdict and says how it was checked',
      },
      claims,
      (c) =>
        c.verdict && c.how && c.how.length > 20
          ? null
          : {
              row: c.text.slice(0, 60),
              problem: 'no verdict or no method',
              page: bottleneckHref(c.bottleneck),
            },
    ),
  ];
}

export function corpusChecks(): CheckResult[] {
  return [...producerChecks(), ...dependencyChecks(), ...eventChecks(), ...claimChecks()];
}
