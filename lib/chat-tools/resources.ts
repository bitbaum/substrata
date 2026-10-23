/**
 * Who produces a raw resource, country by country, from the tables the atlas
 * draws (USGS Mineral Commodity Summaries, EIA). Asked "what is going on with
 * gallium", the assistant said it had no production data while the atlas
 * showed China at ~100% of 2025 primary output; asked whether Russia matters,
 * it could not see Russia's 44% of world palladium. These rows close that gap.
 */
import { countryHref } from '@/lib/world/pages';
import { choropleth, choroplethOptions } from '../resources/choropleth';
import { chapterFor, seriesOf } from '../resources/usgs';
import { countryResources } from '../resources/country';
import { resolveIn } from '../entities/registry';
import { norm } from './resolve';
import { remember } from './ledger';
import { str, type ChatTool } from './tool';

const TOP = 8;

/**
 * A quantity as the reader should see it: the number and the unit exactly as
 * the table prints them ("6,000 kg"), and "(estimated)" where the agency marks
 * the value as an estimate. The model copies this string; it never builds one.
 *
 * Handed "900,000" and "kilograms", gpt-oss wrote "900 kt" (it is 900 t) on
 * 2026-10-02. A human-scale reading was added beside it ("6,000 kg (= 6 t)"),
 * and on 2026-10-23 the answer said Russia made "6 kt" of gallium — the "6"
 * from the reading, a "k" from nowhere: a thousandfold overstatement. Every
 * extra spelling is one more thing to recombine, so there is one spelling, the
 * table's, and grounding.ts flags a figure written in any other unit.
 */
export function quantityDisplay(text: string, unit: string, estimated = false): string {
  const numberLike = /^(more than |less than )?[\d,.]+$/.test(text);
  const shown = numberLike ? `${text} ${unit}` : text;
  return estimated ? `${shown} (estimated)` : shown;
}
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
        measure: {
          type: 'string',
          description:
            '"production" (default) or "reserves" — what is in the ground, where USGS publishes it',
        },
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
        const reserves = /reserve/i.test(str(a.measure));
        const map = reserves
          ? choropleth(resource.resource, { measure: 'reserves' })
          : choropleth(resource.resource, named ? { series: named.id } : {});
        if (reserves && !map)
          return { error: `USGS publishes no reserves table for ${resource.commodity}.` };
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
          // The unit as the table prints it; `unit_name` only says what it means.
          unit: map.unit,
          unit_name: map.unitLabel,
          world_total: { display: quantityDisplay(map.world.text, map.unit) },
          // `value_number` and `share_pct` are the plain numbers a chart block
          // takes (chatkit's RICH_ANSWERS_INSTRUCTION: bars with a share); `display`
          // is what prose quotes, verbatim. `page` per row is the country's atlas page.
          top_producers: ranked.slice(0, TOP).map((v) => ({
            country: v.name,
            display: quantityDisplay(v.text, map.unit, v.estimated),
            value_number: v.value,
            world_share: pct(v.share),
            share_pct: v.share === null ? null : Number((v.share * 100).toFixed(1)),
            rank: v.rank,
            page: `/atlas?view=world&country=${v.iso2}`,
          })),
          ...(country
            ? {
                [country.name]: one
                  ? {
                      display: quantityDisplay(one.text, map.unit, one.estimated),
                      world_share: pct(one.share),
                      rank: one.rank,
                    }
                  : 'Not listed in this table (not a measured producer).',
              }
            : {}),
          page: `/resources/${resource.resource}`,
          source: { label: map.source.label, url: map.source.url },
          note: 'Quote each quantity by copying its `display` exactly — same number, same unit. Never convert or abbreviate the unit.',
          status:
            'Sourced (primary statistical source); "(estimated)" values are the agency\'s estimates',
        };
      }

      if (country) {
        const { measured, unmeasured } = countryResources(country.iso2);
        return {
          country: country.name,
          page: countryHref(country.iso2),
          produces: measured.slice(0, 12).map((f) => {
            const lead = f.production[0];
            return {
              resource: f.label,
              measure: lead?.label,
              year: lead?.year,
              display: lead
                ? quantityDisplay(lead.current.text, lead.unit, lead.current.estimated)
                : undefined,
              unit: lead?.unit,
              value_number: lead?.current.value ?? null,
              world_share: lead ? pct(lead.current.share) : null,
              share_pct:
                lead?.current.share == null ? null : Number((lead.current.share * 100).toFixed(1)),
              rank: lead?.current.rank ?? null,
              page: `/resources/${f.resource}`,
              source: f.source.url,
            };
          }),
          present_but_unmeasured: unmeasured.slice(0, 10).map((u) => u.label),
          note: 'Quote each quantity by copying its `display` exactly — same number, same unit. Never convert or abbreviate the unit.',
          status: 'Sourced (USGS / EIA tables)',
        };
      }
      return { error: 'Give a resource, a country, or both.' };
    },
  },
];
