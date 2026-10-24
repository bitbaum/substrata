/**
 * Row counts for a country's boxes, from the data the repository holds today.
 * A box with no counter here (trade, people and labs) counts only relations.
 */
import { EVENTS } from '@/config/substrata-events';
import { FACILITIES } from '@/config/substrata-facilities';
import { INSTRUMENTS, type InstrumentKind } from '@/config/substrata-policy';
import { ENDOWMENTS } from '@/config/substrata-quantities';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { countryResources } from '@/lib/resources/country';
import { restrictionsFor } from '@/lib/resources/restrictions';
import type { RowCounts } from '../definitions';
import type { Subject } from '../subjects';
import { USGS_ROWS, gradeOf, operatorOf, plus, tally, usgsYear } from './shared';

/** The instrument kinds that say how a country licenses extraction or processing. */
export const LICENSING_KINDS: readonly InstrumentKind[] = ['licence-regime', 'permit', 'procedure'];

const of = (j: string, iso2: string) => j.toLowerCase() === iso2;

function endowmentOutput(iso2: string): RowCounts {
  const { measured, unmeasured } = countryResources(iso2);
  const tables = tally(
    measured,
    () => 'stated',
    `${measured.length} resource${measured.length === 1 ? '' : 's'} measured in USGS, EIA or WNA tables` +
      (unmeasured.length > 0
        ? `; the directory also names ${unmeasured.map((u) => u.label.toLowerCase()).join(', ')}, which no table measures`
        : ''),
    { expected: measured.length + unmeasured.length },
  );
  const rows = ENDOWMENTS.filter((e) => e.place === iso2);
  return rows.length > 0
    ? plus(
        tables,
        tally(rows, gradeOf, `${rows.length} endowment row${rows.length === 1 ? '' : 's'}`),
      )
    : tables;
}

function facilities(iso2: string): RowCounts {
  const usgs = USGS_ROWS.filter((r) => r.iso2 === iso2);
  const curated = FACILITIES.filter((f) => f.place === iso2);
  const year = usgsYear(iso2);
  return plus(
    tally(
      usgs,
      () => 'stated',
      year
        ? `${usgs.length} rows in the USGS Minerals Yearbook chapter (${year})`
        : 'no USGS Minerals Yearbook chapter read',
    ),
    tally(curated, gradeOf, curated.length > 0 ? `${curated.length} named facilities` : ''),
  );
}

function companies(iso2: string): RowCounts {
  // Distinct by lower-cased name: one operator over twelve rows is one company.
  const grades = new Map<string, 'stated' | 'lead'>();
  for (const r of USGS_ROWS) {
    const name = r.iso2 === iso2 ? operatorOf(r.companies) : null;
    if (name) grades.set(name.toLowerCase(), 'stated');
  }
  const usgsCount = grades.size;
  let directory = 0;
  for (const p of MARKET_PARTICIPANTS) {
    if (!p.jurisdictions.some((j) => of(j, iso2))) continue;
    const key = p.name.toLowerCase();
    const sourced = p.hasVerifiedRow || p.directorySource !== null;
    if (grades.get(key) !== 'stated') grades.set(key, sourced ? 'stated' : 'lead');
    directory += 1;
  }
  return tally(
    [...grades.values()],
    (g) => g,
    `${usgsCount} operators named by USGS; ${directory} directory companies`,
  );
}

function lawLicensing(iso2: string): RowCounts {
  const own = INSTRUMENTS.filter((i) => i.jurisdiction === iso2);
  const measures = restrictionsFor(iso2);
  const licensing = own.filter((i) => LICENSING_KINDS.includes(i.kind) && gradeOf(i) === 'stated');
  return plus(
    tally(own, gradeOf, `${own.length} instruments it issues (${licensing.length} on licensing)`, {
      core: licensing.length,
    }),
    tally(measures, () => 'stated', `${measures.length} OECD export measures`),
  );
}

function events(iso2: string): RowCounts {
  const rows = EVENTS.filter((e) => e.jurisdictions.some((j) => of(j, iso2)));
  return tally(rows, gradeOf, `${rows.length} accepted events in its jurisdiction`);
}

export const COUNTRY_COUNTERS: Record<string, (s: Subject) => RowCounts> = {
  endowment_output: (s) => endowmentOutput(s.key),
  facilities: (s) => facilities(s.key),
  companies: (s) => companies(s.key),
  law_licensing: (s) => lawLicensing(s.key),
  events: (s) => events(s.key),
};
