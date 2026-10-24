/**
 * Which facility rows measure the same thing as a national series.
 *
 * A mass balance is only honest when both sides count the same material at the
 * same step: copper CONTENT at the MINE against copper content at the mine, not
 * refinery cathode, not ore tonnage, not a lithium-carbonate equivalent against
 * lithium content. USGS prints the basis in the row's commodity and group
 * cells ("Mine, Cu content", group "Nickel, Ni content" + commodity "Mine"), so
 * the test is on those words, per national series, written out here.
 *
 * A row is accepted only when its words state the series' basis. A row that
 * states a different stage or compound, or does not say, is reported with that
 * reason and never added. One relaxation, stated: a row that names the content
 * but no stage is accepted when the national source publishes only one stage
 * for the material (WNA uranium, MCS lithium) — there is nothing else it could
 * be compared against.
 */

export interface SeriesSpec {
  resource: string;
  /** Column key without the year, as in the national file (`mine`, `refinery-alumina`). */
  series: string;
  /** What both sides count, in words a page prints. */
  basis: string;
  /** The material word a multi-part capacity cell uses for this series ("copper"). */
  material: string;
  /** For a content series: the element symbol printed before "content". */
  symbol?: string;
  /** For a series measured gross (ore, alumina, helium): the row words that say so. */
  gross?: RegExp;
  /** Test `gross` on the group and commodity together: rare earths print "REO equivalent" in the group. */
  grossInGroup?: boolean;
  /** Only this stage (`refinery`) instead of the default mine stage. */
  stage?: 'refinery';
}

const content = (resource: string, symbol: string, material: string, what: string) => ({
  resource,
  series: 'mine',
  basis: `${what} content, mined`,
  material,
  symbol,
});

/** Per resource, in priority order: the series a ratio is tried against, first match wins. */
export const SERIES_SPECS: readonly SeriesSpec[] = [
  content('uranium', 'u', 'uranium', 'uranium (U)'),
  content('copper', 'cu', 'copper', 'copper'),
  { resource: 'copper', series: 'refinery', basis: 'refined copper', material: 'copper', stage: 'refinery' },
  content('lithium', 'li', 'lithium', 'lithium'),
  content('cobalt', 'co', 'cobalt', 'cobalt'),
  content('nickel', 'ni', 'nickel', 'nickel'),
  content('tin', 'sn', 'tin', 'tin'),
  content('tungsten', 'w', 'tungsten', 'tungsten (W)'),
  content('antimony', 'sb', 'antimony', 'antimony'),
  content('gold', 'au', 'gold', 'gold'),
  content('silver', 'ag', 'silver', 'silver'),
  { ...content('pgms', 'pt', 'platinum', 'platinum'), series: 'mine-platinum' },
  { ...content('pgms', 'pd', 'palladium', 'palladium'), series: 'mine-palladium' },
  {
    resource: 'iron',
    series: 'mine-usable-ore',
    basis: 'usable iron ore, gross weight',
    material: 'iron ore',
    gross: /iron ore\b.*\b(marketable|gross weight|usable)\b/,
  },
  { ...content('iron', 'fe', 'iron', 'iron (Fe)'), series: 'mine-iron-content' },
  { resource: 'bauxite', series: 'mine-bauxite', basis: 'bauxite, mined', material: 'bauxite', gross: /^bauxite\b/ },
  { resource: 'bauxite', series: 'refinery-alumina', basis: 'alumina', material: 'alumina', gross: /^alumina\b/ },
  {
    resource: 'rare-earths',
    series: 'mine',
    basis: 'rare earths mined, as rare-earth-oxide equivalent',
    material: 'reo',
    gross: /rare-earth-oxide|\breo\b/,
    grossInGroup: true,
  },
  { resource: 'helium', series: 'plant', basis: 'helium', material: 'helium', gross: /^helium$/ },
  {
    resource: 'phosphates',
    series: 'mine',
    basis: 'marketable phosphate rock',
    material: 'phosphate rock',
    gross: /phosphate rock/,
  },
  { resource: 'diamonds', series: 'mine', basis: 'diamonds, mined', material: 'diamonds', gross: /diamond/ },
];

export function specsFor(resource: string): SeriesSpec[] {
  return SERIES_SPECS.filter((s) => s.resource === resource);
}

/** What a row's words say, before any series is tried. */
export interface RowReading {
  /** Group and commodity cells together: the group often carries the basis ("Nickel, Ni content"). */
  text: string;
  /** The commodity cell alone. A gross product is named here; the group may be another section's heading. */
  commodity: string;
  stage: 'mine' | 'refinery' | 'smelter' | 'unstated';
  /** The symbol before "content", if printed. */
  symbol: string | null;
  /** A compound basis that only a chemical factor could convert (Li2CO3, WO3, U3O8). */
  compound: string | null;
}

const COMPOUND =
  /\b(li2co3|lithium carbonate|lithium hydroxide|lithium chloride|wo3|u3o8|oxide|ferro\w*|nickel pig iron|matte|sulfate)\b/;

export function readRow(group: string, commodity: string): RowReading {
  const flat = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase();
  const text = flat(`${group} ${commodity}`);
  const stage = /\bsmelter\b/.test(text)
    ? 'smelter'
    : /\brefin(ed|ery)\b/.test(text)
      ? 'refinery'
      : /\b(mine|mines|ore|concentrates?|deposit)\b/.test(text)
        ? 'mine'
        : 'unstated';
  const sym = /\b([a-z]{1,2}) content\b/.exec(text);
  const compound = COMPOUND.exec(text);
  return { text, commodity: flat(commodity), stage, symbol: sym ? sym[1] : null, compound: compound ? compound[1] : null };
}

/**
 * Whether the row measures what `spec` measures; when not, why — in a phrase
 * a page can print after "not compared:".
 */
export function rowMatches(
  row: RowReading,
  spec: SeriesSpec,
  singleStage: boolean,
): true | { reason: string } {
  if (spec.stage === 'refinery') {
    if (row.stage === 'refinery') return true;
    return { reason: `${row.stage === 'unstated' ? 'stage not printed' : `${row.stage} capacity`}, not refinery` };
  }
  if (spec.gross) {
    if (spec.gross.test(spec.grossInGroup ? row.text : row.commodity) && row.stage !== 'refinery' && row.stage !== 'smelter')
      return true;
    return { reason: `printed as "${row.commodity}", not ${spec.basis}` };
  }
  if (row.stage === 'refinery' || row.stage === 'smelter')
    return { reason: `${row.stage} capacity, not mine output` };
  if (row.symbol && row.symbol === spec.symbol) {
    if (row.stage === 'mine' || singleStage) return true;
    return { reason: 'content printed but not the stage (mine or refinery)' };
  }
  if (row.compound)
    return {
      reason: `printed as ${row.compound}; the national figure is ${spec.basis} and converting needs a chemical factor, not a unit factor`,
    };
  if (row.symbol) return { reason: `printed as ${row.symbol.toUpperCase()} content, not ${spec.basis}` };
  return { reason: 'the row does not say whether it counts metal content or gross tonnage' };
}
