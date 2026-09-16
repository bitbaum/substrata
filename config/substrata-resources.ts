/**
 * Country resource directory — why a place matters for the path.
 *
 * This is NOT a finding. It is a public-geology index (USGS commodity
 * summaries, national geological surveys, IAEA Red Book class of fact) so
 * that clicking Niger or Argentina is never a blank panel. Rows say
 * `directory`. Promote a row into coverage only with a producer source.
 *
 * relatedBottlenecks must be exact names in the coverage universe, or empty.
 */

export type ResourceId =
  | 'uranium'
  | 'lithium'
  | 'copper'
  | 'cobalt'
  | 'nickel'
  | 'rare-earths'
  | 'graphite'
  | 'iron'
  | 'bauxite'
  | 'tin'
  | 'pgms'
  | 'helium'
  | 'quartz'
  | 'natural-gas'
  | 'oil'
  | 'hydropower'
  | 'phosphates'
  | 'gallium'
  | 'gold'
  | 'coal'
  | 'diamonds'
  | 'neon'
  | 'boron'
  | 'silver';

export const RESOURCE_KINDS: readonly { id: ResourceId; label: string; why: string }[] = [
  { id: 'uranium', label: 'Uranium', why: 'Fuel for fission. Without it, nuclear is a drawing.' },
  {
    id: 'lithium',
    label: 'Lithium',
    why: 'The metal every battery-scale storage build currently eats.',
  },
  {
    id: 'copper',
    label: 'Copper',
    why: 'Grids, motors, data centres — electrification is copper.',
  },
  {
    id: 'cobalt',
    label: 'Cobalt',
    why: 'Cathodes and superalloys. Hard to drop without a chemistry change.',
  },
  {
    id: 'nickel',
    label: 'Nickel',
    why: 'Cathodes, alloys, and the steels that live at high temperature.',
  },
  {
    id: 'rare-earths',
    label: 'Rare earths',
    why: 'Permanent magnets for motors, wind, and almost every robot joint.',
  },
  {
    id: 'graphite',
    label: 'Graphite',
    why: 'Anodes. Natural and synthetic both sit on the battery curve.',
  },
  {
    id: 'iron',
    label: 'Iron ore',
    why: 'Steel, including the electrical steels that make transformers.',
  },
  {
    id: 'bauxite',
    label: 'Bauxite / aluminium',
    why: 'Gallium is a by-product of alumina. Light structures and wiring.',
  },
  { id: 'tin', label: 'Tin', why: 'Solders and the droplets that make EUV light.' },
  {
    id: 'pgms',
    label: 'Platinum-group metals',
    why: 'Catalysts, hydrogen, and some high-temperature processes.',
  },
  {
    id: 'helium',
    label: 'Helium',
    why: 'Cryogenics for MRI, quantum, and some semiconductor tools.',
  },
  {
    id: 'quartz',
    label: 'High-purity quartz',
    why: 'Crucibles that grow the silicon every wafer starts from.',
  },
  {
    id: 'natural-gas',
    label: 'Natural gas',
    why: 'Firm power and the feedstock for many chemicals.',
  },
  { id: 'oil', label: 'Oil', why: 'Still the energy floor most logistics run on.' },
  {
    id: 'hydropower',
    label: 'Hydropower',
    why: 'The cheapest firm low-carbon electrons, where the river allows.',
  },
  {
    id: 'phosphates',
    label: 'Phosphates',
    why: 'Not a chip input. Food-system constraint that still gates civilisation.',
  },
  { id: 'gallium', label: 'Gallium', why: 'Recovered from alumina. Fast power and radio chips.' },
  { id: 'gold', label: 'Gold', why: 'Bonding wire and a store of value. Not the bottleneck.' },
  {
    id: 'coal',
    label: 'Coal',
    why: 'Still a large share of industrial heat and power in several grids.',
  },
  {
    id: 'diamonds',
    label: 'Diamond (industrial)',
    why: 'Heat spreaders and cutting. Lab-grown is the compute story.',
  },
  {
    id: 'neon',
    label: 'Neon',
    why: 'Excimer lasers in older lithography. A steel-plant by-product.',
  },
  { id: 'boron', label: 'Boron', why: 'Glasses, magnets, and some nuclear uses.' },
  { id: 'silver', label: 'Silver', why: 'The most conductive metal. PV paste and electronics.' },
];

export interface CountryResource {
  iso2: string;
  resources: ResourceId[];
  /** One sentence: why this country is on the path. */
  why: string;
  /** Exact bottleneck names, or empty. */
  relatedBottlenecks: string[];
}

export const COUNTRY_RESOURCES: readonly CountryResource[] = [
  {
    iso2: 'ne',
    resources: ['uranium'],
    why: 'One of the world’s significant uranium producers. Nuclear fuel starts in the ground here.',
    relatedBottlenecks: ['Uranium conversion and enrichment'],
  },
  {
    iso2: 'ar',
    resources: ['lithium', 'copper'],
    why: 'The lithium triangle. Battery-scale storage is a geology problem as much as a factory problem.',
    relatedBottlenecks: ['Battery-grade lithium chemicals'],
  },
  {
    iso2: 'cl',
    resources: ['copper', 'lithium'],
    why: 'The largest copper producer. Every extra megawatt of grid and every motor is copper.',
    relatedBottlenecks: ['Battery-grade lithium chemicals'],
  },
  {
    iso2: 'bo',
    resources: ['lithium'],
    why: 'Salar brine lithium, barely industrialised. The resource is not the same as a chemical plant.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'au',
    resources: ['lithium', 'iron', 'uranium', 'bauxite', 'nickel'],
    why: 'A materials superpower for the energy and compute build: lithium, iron, uranium, alumina.',
    relatedBottlenecks: ['Electronic-grade polysilicon', 'Crucible-grade high-purity quartz sand'],
  },
  {
    iso2: 'cn',
    resources: ['rare-earths', 'graphite', 'gallium', 'copper', 'tin'],
    why: 'Refining, magnets, graphite anodes, gallium. The midstream, not just the mine.',
    relatedBottlenecks: [
      'Gallium, refined',
      'Didymium (Nd-Pr) metal, magnet feed',
      'Dysprosium metal',
    ],
  },
  {
    iso2: 'cd',
    resources: ['cobalt', 'copper'],
    why: 'Most of the world’s cobalt. Cathode chemistry still depends on it.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'za',
    resources: ['pgms', 'gold', 'coal'],
    why: 'Platinum-group metals the hydrogen and catalyst chains cannot easily drop.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'kz',
    resources: ['uranium', 'copper'],
    why: 'The largest uranium miner. Fission fuel is a Kazakh fact before it is a reactor fact.',
    relatedBottlenecks: ['Uranium conversion and enrichment'],
  },
  {
    iso2: 'ca',
    resources: ['uranium', 'nickel', 'hydropower', 'oil'],
    why: 'Uranium, nickel, hydro electrons, and oil sands. A northern materials and power base.',
    relatedBottlenecks: ['Liquid helium (He-4)'],
  },
  {
    iso2: 'us',
    resources: ['helium', 'natural-gas', 'oil', 'copper', 'lithium'],
    why: 'Helium, gas turbines, and the permission to build. The constraint is often the queue, not the rock.',
    relatedBottlenecks: [
      'Grid interconnection queues',
      'Heavy-duty gas turbine order books',
      'Liquid helium (He-4)',
    ],
  },
  {
    iso2: 'no',
    resources: ['hydropower', 'natural-gas', 'oil', 'nickel'],
    why: 'Hydro and gas that Europe’s industry actually runs on.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'pe',
    resources: ['copper'],
    why: 'Copper. Same story as Chile, different Andes.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'id',
    resources: ['nickel', 'tin', 'bauxite', 'natural-gas'],
    why: 'Nickel laterites that battery chemistries currently need, and tin.',
    relatedBottlenecks: ['High-purity tin, EUV droplet grade'],
  },
  {
    iso2: 'my',
    resources: ['tin', 'natural-gas'],
    why: 'Tin refining and a chemicals/electronics manufacturing base.',
    relatedBottlenecks: ['High-purity tin, EUV droplet grade'],
  },
  {
    iso2: 'gn',
    resources: ['bauxite'],
    why: 'Bauxite. Aluminium and the gallium that comes out of alumina refining.',
    relatedBottlenecks: ['Gallium, refined'],
  },
  {
    iso2: 'ma',
    resources: ['phosphates'],
    why: 'Phosphate rock. Not a chip input; still a civilisation input.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'na',
    resources: ['uranium', 'diamonds'],
    why: 'Uranium mines that feed the same fuel cycle as Niger and Kazakhstan.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'uz',
    resources: ['uranium', 'gold'],
    why: 'Uranium and a Central Asian materials base.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'ru',
    resources: ['natural-gas', 'oil', 'nickel', 'pgms', 'uranium'],
    why: 'Gas, nickel, PGMs. Sanctions make the map a permission problem as well as a geology one.',
    relatedBottlenecks: ['Neon, excimer laser grade'],
  },
  {
    iso2: 'ua',
    resources: ['iron', 'neon'],
    why: 'Steel and the neon that used to come out of steel-plant air separation.',
    relatedBottlenecks: ['Neon, excimer laser grade', 'Grain-oriented electrical steel (GOES)'],
  },
  {
    iso2: 'br',
    resources: ['iron', 'bauxite', 'hydropower', 'nickel'],
    why: 'Iron, alumina, hydro. A materials and power base in the southern hemisphere.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'in',
    resources: ['iron', 'bauxite', 'rare-earths', 'coal'],
    why: 'A manufacturing and power build that will eat copper, steel and permission.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'jp',
    resources: [],
    why: 'Almost no mines, almost all of the chemistry and precision machinery the chain qualifies against.',
    relatedBottlenecks: [
      'Photoresist formulation',
      '300 mm prime silicon wafers',
      'Electronic-grade polysilicon',
    ],
  },
  {
    iso2: 'kr',
    resources: [],
    why: 'Memory, wafers, batteries. The constraint is process knowledge and packaging, not ore.',
    relatedBottlenecks: [
      'High-bandwidth memory stacking yield',
      'Advanced packaging capacity',
      '300 mm prime silicon wafers',
    ],
  },
  {
    iso2: 'tw',
    resources: [],
    why: 'Leading-edge foundry and advanced packaging. The compute curve’s physical centre.',
    relatedBottlenecks: ['Leading-edge foundry capacity', 'Advanced packaging capacity'],
  },
  {
    iso2: 'nl',
    resources: [],
    why: 'One factory prints the light every leading-edge wafer needs.',
    relatedBottlenecks: ['EUV lithography scanners'],
  },
  {
    iso2: 'de',
    resources: [],
    why: 'Optics, electrical steel, industrial gases, machines. Know-how more than ore.',
    relatedBottlenecks: [
      'EUV projection optics',
      'Grain-oriented electrical steel (GOES)',
      'Precision reduction drives',
    ],
  },
  {
    iso2: 'gb',
    resources: ['oil', 'natural-gas'],
    why: 'Research base, grid reform, and a North Sea energy system in transition.',
    relatedBottlenecks: ['Grid interconnection queues'],
  },
  {
    iso2: 'fr',
    resources: ['uranium'],
    why: 'The European fission fleet. Nuclear is a French industrial fact.',
    relatedBottlenecks: ['Uranium conversion and enrichment', 'SMR first-of-a-kind licensing'],
  },
  {
    iso2: 'sa',
    resources: ['oil', 'natural-gas'],
    why: 'Oil that still sets the energy floor, and a state trying to buy a post-oil industrial base.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'qa',
    resources: ['natural-gas'],
    why: 'LNG. Firm gas that other people’s industry burns.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'ae',
    resources: ['oil', 'natural-gas'],
    why: 'Oil, gas, and capital that can wait longer than a venture fund.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'sg',
    resources: [],
    why: 'A chemicals, trading and advanced-manufacturing node with no mines of its own.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'il',
    resources: ['natural-gas'],
    why: 'Chips, lasers, and a research density far above its land area.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'ch',
    resources: ['hydropower'],
    why: 'Precision machinery, hydro, and where this project is written.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'se',
    resources: ['iron', 'hydropower'],
    why: 'Iron, hydro, and a northern industrial base for steel and machines.',
    relatedBottlenecks: ['Grain-oriented electrical steel (GOES)'],
  },
  {
    iso2: 'fi',
    resources: ['nickel', 'hydropower'],
    why: 'Nickel and a Nordic power/materials base.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'pl',
    resources: ['coal' as ResourceId, 'copper'],
    why: 'Copper and a European industrial permission problem.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'mx',
    resources: ['copper', 'oil', 'silver'],
    why: 'Copper and a North American manufacturing base next to US demand.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'mn',
    resources: ['copper', 'coal'],
    why: 'Copper that feeds Chinese refining.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'pg',
    resources: ['copper', 'gold'],
    why: 'Copper-gold. A Pacific materials node.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'zm',
    resources: ['copper', 'cobalt'],
    why: 'Copperbelt. Same geology family as the DRC, different state.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'ao',
    resources: ['oil', 'diamonds'],
    why: 'Oil. An Atlantic energy node.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'ng',
    resources: ['oil', 'natural-gas'],
    why: 'Oil and gas. Energy that does not yet industrialise at home.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'eg',
    resources: ['natural-gas', 'oil'],
    why: 'Gas and a Suez logistics chokepoint for everyone else’s materials.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'tr',
    resources: ['boron'],
    why: 'A manufacturing and permission bridge between European demand and Asian supply.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'vn',
    resources: ['bauxite', 'rare-earths'],
    why: 'Manufacturing that is absorbing electronics and materials steps leaving China.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'th',
    resources: [],
    why: 'A Southeast Asian manufacturing and chemicals node.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'ph',
    resources: ['nickel'],
    why: 'Nickel laterites on the same battery curve as Indonesia.',
    relatedBottlenecks: [],
  },
  {
    iso2: 'nz',
    resources: ['hydropower'],
    why: 'Hydro and a small, high-skill industrial base.',
    relatedBottlenecks: [],
  },
];

const RESOURCE_LABEL = Object.fromEntries(RESOURCE_KINDS.map((r) => [r.id, r.label])) as Record<
  string,
  string
>;

export function resourcesFor(iso2: string): CountryResource | null {
  return COUNTRY_RESOURCES.find((row) => row.iso2 === iso2.toLowerCase()) ?? null;
}

export function resourceLabel(id: string): string {
  return RESOURCE_LABEL[id] ?? id;
}

export const RESOURCE_DIRECTORY_NOTE =
  'Directory of public geology and industrial role, not a finding. A producer row with a source is the only way a mineral here becomes coverage.';
