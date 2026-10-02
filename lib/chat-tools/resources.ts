/**
 * Who produces a raw resource, country by country, from the tables the atlas
 * draws (USGS Mineral Commodity Summaries, EIA). Asked "what is going on with
 * gallium", the assistant said it had no production data while the atlas
 * showed China at ~100% of 2025 primary output; asked whether Russia matters,
 * it could not see Russia's 44% of world palladium. These rows close that gap.
 */
import { choropleth, choroplethOptions } from '../resources/choropleth';
import { chapterFor, seriesOf } from '../resources/usgs';
import { countryResources } from '../resources/country';
import { resolveIn } from '../entities/registry';
import { norm } from './resolve';
import { remember } from './ledger';
import { str, type ChatTool } from './tool';

const TOP = 8;
const pct = (share: number | null) =>
  share === null ? null : `${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%`;

/**
 * The names people use for what the tables file under another heading:
 * palladium is reported as platinum-group metals, neodymium as rare earths.
 */
const SYNONYMS: Record<string, string> = {
  palladium: 'pgms',
  platinum: 'pgms',
  ruthenium: 'pgms',
  rhodium: 'pgms',
  iridium: 'pgms',
  pgm: 'pgms',
  neodymium: 'rare-earths',
  dysprosium: 'rare-earths',
  terbium: 'rare-earths',
  praseodymium: 'rare-earths',
  'rare earth': 'rare-earths',
  aluminium: 'bauxite',
  aluminum: 'bauxite',
  alumina: 'bauxite',
  polysilicon: 'silicon',
  'crude oil': 'oil',
  petroleum: 'oil',
  'natural gas': 'natural-gas',
  lng: 'natural-gas',
  'iron ore': 'iron',
  steel: 'iron',
  diamond: 'diamonds',
  phosphate: 'phosphates',
};

/**
 * A resource the tables cover, by id, commodity name or common synonym, with
 * the word in the text that named it ("palladium" picks that series later).
 */
export function resourceIn(
  text: string,
): { resource: string; commodity: string; term: string } | undefined {
  const q = ` ${norm(text)} `;
  const options = choroplethOptions();
  const synonym = Object.entries(SYNONYMS).find(
    ([word]) => q.includes(` ${word} `) || q.includes(` ${word}s `),
  );
  if (synonym) {
    const hit = options.find((o) => o.resource === synonym[1]);
    if (hit) return { ...hit, term: synonym[0] };
  }
  const exact = options.find(
    (o) => q.includes(` ${norm(o.resource)} `) || q.includes(` ${norm(o.commodity)} `),
  );
  if (exact) return { ...exact, term: exact.commodity };
  for (const o of options) {
    const word = norm(o.commodity)
      .split(' ')
      .find((w) => w.length > 4 && q.includes(` ${w} `));
    if (word) return { ...o, term: word };
  }
  return undefined;
}

function countryIso(name: string): { iso2: string; name: string } | undefined {
  const entity = resolveIn('country', name.trim());
  return entity ? { iso2: entity.key, name: entity.name } : undefined;
}

export const RESOURCE_TOOLS: ChatTool[] = [
  {
    name: 'resource_production',
    description:
      "Country-by-country production (and reserves where published) of a raw resource — metals, minerals, gases, energy — from USGS and EIA tables: world total, top producers with world shares and ranks, the year and the source. Give `resource` for who produces it; give `country` (alone) for what a country produces and its world rank; give both for one country's share of one resource.",
    parameters: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'e.g. gallium, palladium, helium, natural gas' },
        country: { type: 'string', description: 'Country name, e.g. Russia, China' },
      },
    },
    label: (a) =>
      `Reading production tables${str(a.resource) ? ` for ${str(a.resource)}` : ''}${str(a.country) ? ` in ${str(a.country)}` : ''}`,
    run: async (a, env) => {
      const resource = str(a.resource) ? resourceIn(str(a.resource)) : undefined;
      const country = str(a.country) ? countryIso(str(a.country)) : undefined;
      if (str(a.resource) && !resource)
        return {
          error: `No production table for "${str(a.resource)}".`,
          tables: choroplethOptions().map((o) => o.commodity),
        };
      if (str(a.country) && !country) return { error: `No country called "${str(a.country)}".` };

      if (resource) {
        // "palladium" is a series inside the platinum-group table: read that one.
        const asked = norm(str(a.resource));
        const chapter = chapterFor(resource.resource);
        const named = chapter
          ? seriesOf(chapter).find((s) =>
              norm(s.label)
                .split(' ')
                .some((w) => w.length > 4 && asked.split(' ').includes(w)),
            )
          : undefined;
        const map = choropleth(resource.resource, named ? { series: named.id } : {});
        if (!map) return { error: `No production table for ${resource.commodity}.` };
        remember(env.ledger, {
          title: `${map.commodity}: ${map.label}`,
          href: `/resources/${resource.resource}`,
          kind: 'resource',
          evidence: 'Sourced',
          primary: [map.source.url],
        });
        const ranked = Object.values(map.values)
          .filter((v) => v.rank !== null)
          .sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99));
        const one = country ? map.values[country.iso2] : undefined;
        return {
          resource: map.commodity,
          measure: map.label,
          year: map.year,
          unit: map.unitLabel,
          world_total: map.world.text,
          top_producers: ranked.slice(0, TOP).map((v) => ({
            country: v.name,
            value: v.text,
            world_share: pct(v.share),
            rank: v.rank,
            estimated: v.estimated || undefined,
          })),
          ...(country
            ? {
                [country.name]: one
                  ? { value: one.text, world_share: pct(one.share), rank: one.rank }
                  : 'Not listed in this table (not a measured producer).',
              }
            : {}),
          page: `/resources/${resource.resource}`,
          source: { label: map.source.label, url: map.source.url },
          status: 'Sourced (primary statistical source); "e" values are the agency\'s estimates',
        };
      }

      if (country) {
        const { measured, unmeasured } = countryResources(country.iso2);
        return {
          country: country.name,
          page: `/atlas?view=world&country=${country.iso2}`,
          produces: measured.slice(0, 12).map((f) => {
            const lead = f.production[0];
            return {
              resource: f.label,
              measure: lead?.label,
              year: lead?.year,
              value: lead?.current.text,
              world_share: lead ? pct(lead.current.share) : null,
              rank: lead?.current.rank ?? null,
              source: f.source.url,
            };
          }),
          present_but_unmeasured: unmeasured.slice(0, 10).map((u) => u.label),
          status: 'Sourced (USGS / EIA tables)',
        };
      }
      return { error: 'Give a resource, a country, or both.' };
    },
  },
];
