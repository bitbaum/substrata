/**
 * What the network checks look at: every source URL each dataset cites, and
 * every quote that should still be on its page. Enumerated from the committed
 * files, so a new row is checked from the next run on without registering it.
 */
import listingsFile from '@/research/listings.json';
import mcs from '@/research/usgs-mcs.json';
import eia from '@/research/eia-energy.json';
import oecd from '@/research/oecd-export-restrictions.json';
import sanctions from '@/research/sanctions.json';
import producers from '@/research/usgs-producers.json';
import jobBoards from '@/research/job-boards.json';
import learningPaths from '@/research/learning-paths.json';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { CHOKEPOINTS } from '@/config/substrata-coverage';
import { PARTICIPANTS } from '@/config/substrata-participants';
import { DEPENDENCIES } from '@/config/substrata-dependencies';
import { EVENTS } from '@/config/substrata-events';
import { OFFICIAL_SERIES } from '@/config/substrata-official-series';
import { SCIENCE } from '@/config/substrata-science';
import { corpusSeries } from '@/lib/series';
import { bottleneckHref, marketHref, scienceHref, seriesHref } from '@/lib/links';
import type { Listing } from '@/lib/listings';
import { blsUrl } from './checks-series';

export interface LinkTarget {
  dataset: string;
  row: string;
  url: string;
  page?: string;
}

export interface QuoteTarget extends LinkTarget {
  quote: string;
  /** Stable key for the stored verdict. */
  key: string;
}

const web = (url: string | null | undefined): url is string => !!url && /^https?:\/\//.test(url);

export function linkTargets(): LinkTarget[] {
  const out: LinkTarget[] = [];
  const add = (dataset: string, row: string, url: string | null | undefined, page?: string) => {
    if (web(url)) out.push({ dataset, row, url, page });
  };
  for (const b of BOTTLENECKS)
    for (const p of b.producers)
      add('producers', `${b.name}: ${p.name}`, p.source, bottleneckHref(b.slug));
  for (const c of CHOKEPOINTS) add('producers', c.name, c.source, bottleneckHref(c.name));
  for (const p of PARTICIPANTS)
    add('producers', `Directory: ${p.name}`, p.source, marketHref(p.name));
  for (const d of DEPENDENCIES) add('dependencies', `${d.from} ${d.kind} ${d.on}`, d.source);
  for (const e of EVENTS) add('events', `${e.date} ${e.headline.slice(0, 60)}`, e.source);
  for (const s of corpusSeries())
    for (const p of s.points) add('series', `${s.id} ${p.date}`, p.source, seriesHref(s.id));
  for (const s of OFFICIAL_SERIES)
    add('official-series', s.id, blsUrl(s.agencyId), seriesHref(s.id));
  for (const [slug, l] of Object.entries(
    (listingsFile as { listings: Record<string, Listing> }).listings,
  )) {
    if (l.status !== 'listed' && l.status !== 'parent') continue;
    add('listings', `${slug} primary`, l.primary?.source, marketHref(slug));
    add('listings', `${slug} US`, l.us?.source, marketHref(slug));
  }
  for (const c of mcs.chapters) add('usgs-mcs', c.commodity, c.url, `/resources/${c.resource}`);
  for (const c of eia.chapters) add('eia-energy', c.commodity, c.url, `/resources/${c.resource}`);
  for (const c of producers.countries) {
    add('usgs-producers', `${c.slug} workbook`, c.url);
    add('usgs-producers', `${c.slug} chapter PDF`, c.pdf);
  }
  add('oecd-restrictions', 'OECD data explorer', oecd.explorer);
  add('oecd-restrictions', 'OECD SDMX query', oecd.api);
  for (const r of sanctions.eu.regimes) {
    add('sanctions', `EU ${r.iso2.toUpperCase()} regime`, r.url);
    for (const act of r.legalActs ?? [])
      add('sanctions', `EU ${r.iso2.toUpperCase()} ${act.number}`, act.url);
  }
  for (const p of sanctions.us.programs)
    add('sanctions', `US ${p.iso2.toUpperCase()} programme`, p.url);
  for (const [slug, b] of Object.entries(jobBoards.companies))
    add('jobs', `${slug} careers page`, b.careersUrl, marketHref(slug));
  for (const p of learningPaths.paths) add('learning-paths', p.name, p.url);
  for (const e of SCIENCE) add('science', e.name, e.source, scienceHref(e.id));
  return out;
}

export function quoteTargets(): QuoteTarget[] {
  const out: QuoteTarget[] = [];
  for (const s of corpusSeries())
    for (const p of s.points)
      if (web(p.source) && p.quote)
        out.push({
          dataset: 'series',
          row: `${s.id} ${p.date}`,
          url: p.source,
          quote: p.quote,
          key: `series:${s.id}:${p.date}`,
          page: seriesHref(s.id),
        });
  for (const d of DEPENDENCIES)
    out.push({
      dataset: 'dependencies',
      row: `${d.from} ${d.kind} ${d.on}`,
      url: d.source,
      quote: d.quote,
      key: `dependencies:${d.from}>${d.on}:${d.kind}`,
    });
  for (const e of EVENTS)
    out.push({
      dataset: 'events',
      row: `${e.date} ${e.headline.slice(0, 60)}`,
      url: e.source,
      quote: e.quote,
      key: `events:${e.id}`,
    });
  return out;
}

/** Distinct URLs, each with every row that cites it — one fetch answers them all. */
export function urlsWithRows(
  targets: readonly LinkTarget[] = linkTargets(),
): Map<string, LinkTarget[]> {
  const by = new Map<string, LinkTarget[]>();
  for (const t of targets) by.set(t.url, [...(by.get(t.url) ?? []), t]);
  return by;
}
