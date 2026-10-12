/**
 * The markets lens: who makes it and whether they can be owned, what a stop
 * would reach, which companies are exposed and how, and the numbers that say
 * how tight it is now.
 *
 * The reach is the scenario engine's own (lib/scenario): the same propagation
 * /scenarios runs, so this lens and that page can never disagree. Key numbers
 * are the committed series for the bottleneck, headline first.
 */
import type { Bottleneck } from '@/lib/bottlenecks';
import { listingForName, terminalTicker, type Listing } from '@/lib/listings';
import { marketHref, seriesHref } from '@/lib/links';
import { exposedCompanies, type ExposedCompany } from '@/lib/scenario/exposed';
import { directHits, downstreamHits } from '@/lib/scenario/propagate';
import { scenarioHref } from '@/lib/scenario/target';
import { corpusSeries, seriesFor, type Series } from '@/lib/series';
import { listWords } from '../chain-story';
import { count, top, type Lens, type LensItem } from './types';

const EXPOSURE: Record<string, string> = {
  failed: 'fails with it',
  'lost-maker': 'makes it',
  'partly-affected': 'partly affected',
  'remaining-maker': 'another maker',
  'part-supplier': 'supplies a part',
  'downstream-holder': 'holds a step downstream',
  needs: 'needs it',
  'sells-into': 'sells into it',
};

function ticker(listing: Listing | null): string | null {
  if (!listing || (listing.status !== 'listed' && listing.status !== 'parent')) return null;
  const ref = listing.primary ?? listing.us;
  return ref ? terminalTicker(ref) : null;
}

/** "38.8 EUR bn (2025-12-31)" — the latest point, in the series' own unit. */
function latest(s: Series): string {
  const p = s.points[s.points.length - 1];
  if (!p) return 'no point yet';
  const value = p.low !== undefined ? `${p.low}–${p.value}` : String(p.value);
  return `${value} ${s.unit} (${p.date})`;
}

function companyItem(c: ExposedCompany): LensItem {
  const t = ticker(c.listing);
  const how = [...new Set(c.exposures.map((e) => EXPOSURE[e.kind] ?? e.kind))];
  const where = [...new Set(c.exposures.map((e) => e.bottleneck))];
  return {
    title: c.name,
    meta: [t ?? 'not listed', how.join(', ')].join(' · '),
    text: where.length > 1 ? `Through ${listWords(where)}.` : undefined,
    href: c.slug ? marketHref(c.slug) : undefined,
  };
}

export function marketsLens(chain: Bottleneck): Lens {
  const target = { kind: 'bottleneck' as const, slug: chain.slug, name: chain.name };
  const hits = directHits({ at: target, only: [] });
  const downstream = downstreamHits(hits);
  const exposed = exposedCompanies(hits, downstream, null);
  const listed = exposed.filter((c) => ticker(c.listing));
  const makers = chain.producers.filter((p) => !p.supplier);
  const listedMakers = makers.filter((p) => ticker(listingForName(p.name)));
  const series = seriesFor(corpusSeries(), chain.slug);

  const means: string[] = [];
  if (makers.length === 0) {
    means.push('No maker is on record, so nobody can yet be named as owning it.');
  } else if (listedMakers.length === 0) {
    means.push(
      `None of its ${count(makers.length, 'maker', 'makers')} on record is listed: ${listWords(makers.map((m) => m.name))}. Exposure through public markets runs through customers and suppliers instead.`,
    );
  } else {
    const named = listedMakers.map((m) => `${m.name} (${ticker(listingForName(m.name))})`);
    means.push(
      `${listedMakers.length === makers.length ? (makers.length === 1 ? 'Its only maker' : 'Every maker') : `${listedMakers.length} of its ${makers.length} makers`} on record ${listedMakers.length === 1 ? 'is' : 'are'} listed: ${listWords(named)}.`,
    );
  }
  means.push(
    downstream.length > 0
      ? `A stop here would reach ${count(downstream.length, 'bottleneck', 'bottlenecks')} downstream (${listWords(downstream.map((d) => d.bottleneck))}) and ${count(exposed.length, 'company', 'companies')} on file, ${listed.length} of them listed.`
      : exposed.length > 0
        ? `A stop here reaches ${count(exposed.length, 'company', 'companies')} on file; nothing downstream of it is on record yet.`
        : 'No company on file is exposed through it yet, and nothing downstream of it is on record.',
  );

  return {
    id: 'markets',
    label: 'Markets',
    question: 'What it means for companies and markets',
    means,
    figures: [
      { label: 'Makers', value: String(makers.length), note: `${listedMakers.length} listed` },
      {
        label: 'Companies exposed',
        value: String(exposed.length),
        note: `${listed.length} listed`,
      },
      { label: 'Steps downstream', value: String(downstream.length) },
    ],
    groups: [
      ...(series.length > 0
        ? [
            {
              title: 'Key numbers',
              items: top(series, 4).map((s) => ({
                title: s.metric,
                meta: latest(s),
                href: seriesHref(s.id),
              })),
            },
          ]
        : []),
      {
        title: 'Who is exposed, listed first',
        items: top(
          [...exposed].sort((a, b) => Number(!ticker(a.listing)) - Number(!ticker(b.listing))),
          8,
        ).map(companyItem),
      },
    ],
    more: [
      { label: 'What if it stops', href: scenarioHref({ at: target }) },
      ...(series.length > 0
        ? [{ label: 'All its numbers', href: `/data/series?b=${chain.slug}` }]
        : []),
      { label: 'Exposure table', href: `/exposure?q=${encodeURIComponent(chain.name)}` },
    ],
    weight: exposed.length + series.length,
  };
}
