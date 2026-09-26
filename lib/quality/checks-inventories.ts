/**
 * Pure checks on the inventories read from other registries: the USGS
 * Minerals Yearbook producer tables, the OECD restrictions inventory and
 * sanctions regimes. Split from checks-resources.ts (the world tables).
 */
import oecd from '@/research/oecd-export-restrictions.json';
import sanctions from '@/research/sanctions.json';
import producers from '@/research/usgs-producers.json';
import { RESOURCE_KINDS } from '@/config/substrata-resources';
import { judge, type CheckResult, type Failure } from './types';

const RESOURCE_IDS = new Set<string>(RESOURCE_KINDS.map((r) => r.id));
const isIso2 = (c: unknown) => typeof c === 'string' && /^[a-z]{2}$/.test(c);

/** A cell cut where the workbook wrapped it: ends mid-phrase, or starts lower-case. */
export function isFragment(text: string): boolean {
  const t = text.trim();
  return (
    /(,|\babout|\band|\bof|\bthe|\bin|\bnear|\[[^\]]*)$/.test(t) ||
    /^[a-z(](?![A-Z])/.test(t) ||
    (t.length > 0 && /^[A-Z]?[a-z]*\.?,? \d+%\)/.test(t))
  );
}

export function inventoryChecks(): CheckResult[] {
  const measures = oecd.measures;
  const regimes = [
    ...sanctions.eu.regimes.map((r) => ({ who: 'EU', iso2: r.iso2, title: r.title, url: r.url })),
    ...sanctions.us.programs.map((p) => ({ who: 'US', iso2: p.iso2, title: p.title, url: p.url })),
  ];
  const facilities = producers.countries.flatMap((c) => c.facilities.map((f) => ({ c, f })));
  return [
    judge(
      {
        dataset: 'oecd-restrictions',
        criterion: 'provenance',
        check: 'oecd-restrictions/instrument',
        label: 'Every measure names its legal instrument or legal basis',
      },
      measures,
      (m): Failure | null =>
        m.document || m.legalBasis
          ? null
          : {
              row: `${m.iso2} ${m.resource} ${m.typeLabel}`,
              problem: 'the inventory names no instrument',
              link: oecd.explorer,
            },
    ),
    judge(
      {
        dataset: 'oecd-restrictions',
        criterion: 'completeness',
        check: 'oecd-restrictions/start-date',
        label: 'Every measure has the date it took effect',
      },
      measures,
      (m) =>
        m.introduced
          ? null
          : {
              row: `${m.iso2} ${m.resource} ${m.typeLabel}`,
              problem: 'the inventory gives no start date',
              link: oecd.explorer,
            },
    ),
    judge(
      {
        dataset: 'oecd-restrictions',
        criterion: 'consistency',
        check: 'oecd-restrictions/codes',
        label: 'Every measure names a real country code and a resource the site tracks',
      },
      measures,
      (m) =>
        isIso2(m.iso2) && RESOURCE_IDS.has(m.resource)
          ? null
          : {
              row: `${m.iso2} ${m.resource}`,
              problem: 'unknown country or resource',
              link: oecd.explorer,
            },
    ),
    judge(
      {
        dataset: 'sanctions',
        criterion: 'provenance',
        check: 'sanctions/regime-source',
        label: 'Every regime or programme has a title and a link to its official page',
      },
      regimes,
      (r) =>
        r.title && /^https:\/\//.test(r.url)
          ? null
          : {
              row: `${r.who} ${r.iso2.toUpperCase()}`,
              problem: r.title ? 'no link' : 'no title',
              link: r.url,
            },
    ),
    judge(
      {
        dataset: 'sanctions',
        criterion: 'consistency',
        check: 'sanctions/codes',
        label: 'Every regime is attached to a real country code',
      },
      regimes,
      (r) =>
        isIso2(r.iso2)
          ? null
          : { row: `${r.who} ${r.title.slice(0, 50)}`, problem: 'no country code', link: r.url },
    ),
    judge(
      {
        dataset: 'usgs-producers',
        criterion: 'provenance',
        check: 'usgs-producers/table-row',
        label: 'Every facility comes from a dated Yearbook table with its workbook link',
      },
      facilities,
      ({ c, f }) =>
        /^https:\/\//.test(c.url) && /^\d{4}(-\d{2})?$/.test(c.year) && c.table
          ? null
          : {
              row: `${c.slug}: ${f.commodity} ${f.location}`,
              problem: 'no year, table or link',
              link: c.url,
            },
    ),
    judge(
      {
        dataset: 'usgs-producers',
        criterion: 'completeness',
        check: 'usgs-producers/operator',
        label: 'Every facility names its operating company',
      },
      facilities,
      ({ c, f }) =>
        f.companies
          ? null
          : {
              row: `${c.slug}: ${f.commodity}, ${f.location}`,
              problem: 'no company named',
              link: c.url,
            },
    ),
    judge(
      {
        dataset: 'usgs-producers',
        criterion: 'correctness',
        check: 'usgs-producers/whole-cells',
        label:
          'Every company and location is a whole cell, not a fragment of a wrapped line or a ditto mark',
      },
      facilities,
      ({ c, f }) =>
        isFragment(f.companies) || isFragment(f.location) || /^do\.\d*$/.test(f.location.trim())
          ? {
              row: `${c.slug}: ${f.companies.slice(0, 50)} — ${f.location.slice(0, 50)}`,
              problem: 'reads as part of a wrapped cell',
              link: c.url,
            }
          : null,
    ),
    judge(
      {
        dataset: 'usgs-producers',
        criterion: 'consistency',
        check: 'usgs-producers/codes',
        label: 'Every facility maps to a country code and a resource the site tracks',
      },
      facilities,
      ({ c, f }) =>
        isIso2(c.iso2) && RESOURCE_IDS.has(f.resource)
          ? null
          : {
              row: `${c.slug}: ${f.commodity}`,
              problem: 'unknown country or resource',
              link: c.url,
            },
    ),
  ];
}
