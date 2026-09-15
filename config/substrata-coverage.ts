/**
 * Substrate — Phase 1 coverage universe: the producers of the fifteen.
 *
 * The first research output. For every material under coverage
 * (`substrata.ts` → CATALOGUE), the set of companies that mine, refine,
 * convert or recycle it. Mostly private, mostly uncovered: there is a great
 * deal of published research on chip designers and almost none on who fires
 * crucible-grade quartz or upgrades tin to seven nines.
 *
 * WHAT THIS FILE CLAIMS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * Each entry asserts three things only: a company's name, where it operates,
 * and which step of the chain it occupies. Those are stable, widely documented
 * facts. It asserts NOTHING about capacity, market share, revenue, cost
 * position, or quality — the claims that go stale within a quarter, that move
 * markets when wrong, and that this project has not yet sourced. There is no
 * field for them on purpose: the structure is the discipline, and the research
 * phase is what adds those numbers, each with a citation.
 *
 * Consequently every entry starts at `source: null`, which reads as UNVERIFIED
 * — a research lead, not a finding. A person clears a row by attaching the
 * primary source that confirms the company's role in that material. Coverage
 * progress is measured by how many rows have a source, not by how many rows
 * exist, and `coverageProgress()` below is what reports it.
 *
 * This is the mandate's own rule turned on the firm: an unsourced claim is
 * marked unverified rather than stated, however confident the analyst is.
 *
 * Created: 2026-08-26
 */

import { MATERIALS, type CurveId, type NodeType } from './substrata';

// =====================================================================
// SHAPE
// =====================================================================

/**
 * Where a company sits in the chain. A single firm can appear on more than one
 * material, and at different steps on each — that overlap is precisely the
 * structure the map exists to expose.
 */
export const PRODUCER_ROLES = [
  {
    id: 'mine',
    label: 'Mine / extract',
    detail: 'Primary extraction, or recovery as a by-product.',
  },
  { id: 'refine', label: 'Refine', detail: 'Purification to the grade the application needs.' },
  {
    id: 'convert',
    label: 'Convert',
    detail: 'Into the form that ships: ingot, wafer, tape, coil, target.',
  },
  { id: 'recycle', label: 'Recycle', detail: 'Secondary supply — often the only elastic source.' },
] as const;

export type ProducerRole = (typeof PRODUCER_ROLES)[number]['id'];

export interface Producer {
  /** Company name as it trades. */
  name: string;
  /** ISO 3166-1 alpha-2 of the operating jurisdiction(s) for this material. */
  jurisdictions: string[];
  role: ProducerRole;
  /**
   * Primary source confirming this company's role in this material.
   * `null` = unverified research lead. Never present an unsourced row as a
   * finding — see the header.
   */
  source: string | null;
  /**
   * Other names this company is written under, where the row's name is not the
   * one the web uses. Tanaka Kikinzoku trades in English as TANAKA Precious
   * Metals; Syensqo was Solvay's specialty spin-out and most pages still say
   * Solvay. Without these the search looks for a string nobody writes.
   */
  aliases?: string[];
}

export interface MaterialCoverage {
  /** Must exactly match a CATALOGUE title in `substrata.ts`. */
  material: string;
  /** What makes this material a chokepoint, in one line — the research thesis. */
  thesis: string;
  producers: Producer[];
}

/** Shorthand: every row starts unverified, because every row starts unsourced. */
function lead(
  name: string,
  jurisdictions: string[],
  role: ProducerRole,
  aliases?: string[],
): Producer {
  return { name, jurisdictions, role, source: null, ...(aliases ? { aliases } : {}) };
}

/**
 * A row an analyst has confirmed: the source is the company's own page, filing
 * or release stating that it handles this material in this step. Read on the
 * date the row was promoted; git carries that date.
 */
function sourced(
  name: string,
  jurisdictions: string[],
  role: ProducerRole,
  source: string,
): Producer {
  return { name, jurisdictions, role, source };
}

// =====================================================================
// THE UNIVERSE
// =====================================================================

export const COVERAGE: readonly MaterialCoverage[] = [
  // ---------- Lithography & Optics ----------
  {
    material: 'High-purity tin, EUV droplet grade',
    thesis:
      'Tin metal is not scarce; tin at seven nines, qualified for an EUV source, is. The chokepoint is the upgrading step, not the mine.',
    producers: [
      sourced('Yunnan Tin', ['CN'], 'refine', 'https://en.ytc.cn/'),
      sourced('Minsur', ['PE'], 'refine', 'https://www.internationaltin.org/tag/minsur/'),
      sourced('PT Timah', ['ID'], 'refine', 'https://timah.com/blog/about-us/processing-smelting'),
      sourced(
        'Malaysia Smelting Corporation',
        ['MY'],
        'refine',
        'https://www.msmelt.com/our-business.php',
      ),
      sourced(
        'Indium Corporation',
        ['US'],
        'convert',
        'https://www.indium.com/products/metals/tin/',
      ),
      sourced(
        '5N Plus',
        ['CA', 'DE'],
        'convert',
        'https://www.5nplus.com/en/products/high-purity-metals/',
      ),
      sourced(
        'Aurubis',
        ['DE'],
        'recycle',
        'https://www.internationaltin.org/aurubis-to-recover-tin-from-new-copper-waste-processing-plant-in-belgium/',
      ),
    ],
  },
  {
    material: 'Neon, excimer laser grade',
    thesis:
      'Neon is separated from air, but economically only alongside large-scale air separation attached to steelmaking — which is why an industrial gas map and a war map turned out to be the same map in 2022.',
    producers: [
      sourced(
        'Linde',
        ['GB', 'US', 'DE'],
        'refine',
        'https://www.linde-gas.de/shop/de/de-ig/neon-45-hiq%C2%AE-minican-neon-45-hiq%C2%AE-minican',
      ),
      sourced('Air Liquide', ['FR'], 'refine', 'https://uk.airliquide.com/gases-and-products/neon'),
      sourced('Messer', ['DE'], 'refine', 'https://www.messer-us.com/specialty-gases/neon'),
      sourced(
        'Iceblick',
        ['UA'],
        'refine',
        'https://spie.org/news/photonics-focus/mayjune-2023/supplying-noble-gases-for-photonics-in-war-time',
      ),
      sourced('Cryoin Engineering', ['UA'], 'refine', 'https://cryoin.com/en/products/'),
      lead('Baosteel Gases', ['CN'], 'refine'),
    ],
  },
  {
    material: 'Ruthenium, sputtering and ALD grade',
    thesis:
      'Ruthenium is a by-product of PGM mining, so supply is set by platinum and palladium economics rather than by demand for ruthenium. Refining and target fabrication are separately concentrated.',
    producers: [
      lead('Sibanye-Stillwater', ['ZA'], 'mine'),
      lead('Impala Platinum', ['ZA'], 'mine'),
      sourced(
        'Nornickel',
        ['RU'],
        'mine',
        'https://nornickel.com/business/products/ruthenium/ruthenium-rua/',
      ),
      sourced(
        'Heraeus',
        ['DE'],
        'refine',
        'https://www.heraeus-precious-metals.com/de/products-solutions/metal/ruthenium/',
      ),
      sourced(
        'Johnson Matthey',
        ['GB'],
        'refine',
        'https://matthey.com/products-and-markets/pgms-and-circularity/pgm-markets/ruthenium',
      ),
      sourced(
        'Umicore',
        ['BE'],
        'refine',
        'https://www.umicore.com/en/markets-products/metals/ruthenium/about/',
      ),
      sourced(
        'Furuya Metal',
        ['JP'],
        'convert',
        'https://www.furuyametals.co.jp/english/innovation/ru/',
      ),
      sourced(
        'Tanaka Kikinzoku',
        ['JP'],
        'convert',
        'https://www.newsfilecorp.com/release/130663/Neues-Verfahren-von-TANAKA-erzeugt-ultradnne-RutheniumHalbleiterschichten-von-hoher-Qualitt',
      ),
    ],
  },

  // ---------- Semiconductor Feedstock ----------
  {
    material: 'Electronic-grade polysilicon',
    thesis:
      'Solar-grade polysilicon has many producers; electronic-grade has very few, and the gap between the two is measured in orders of magnitude of impurity, not in price.',
    producers: [
      sourced(
        'Wacker Chemie',
        ['DE', 'US'],
        'refine',
        'https://www.wacker.com/cms/de-de/products/brands/polysilicon/polysilicon.html',
      ),
      sourced(
        'Hemlock Semiconductor',
        ['US'],
        'refine',
        'https://www.hscpoly.com/markets-technologies/electronics/',
      ),
      sourced(
        'Tokuyama',
        ['JP', 'MY'],
        'refine',
        'https://www.tokuyama.co.jp/eng/products/electronic_materials/polysilicon.html',
      ),
      sourced(
        'OCI',
        ['KR', 'MY'],
        'refine',
        'https://www.oci.co.kr/en/products/semiconductor/polysilicon',
      ),
      sourced(
        'Mitsubishi Materials',
        ['JP'],
        'refine',
        'https://www.mmtc.co.jp/en/products/silicon-h.html',
      ),
      lead('REC Silicon', ['US', 'NO'], 'refine'),
    ],
  },
  {
    material: '300 mm prime silicon wafers',
    thesis:
      'Five firms supply essentially all prime 300 mm wafer capacity. Qualification at a leading-edge fab takes years, so the barrier is certification history rather than capital.',
    producers: [
      sourced('Shin-Etsu Handotai', ['JP'], 'convert', 'https://www.sehe.com/products/'),
      sourced('SUMCO', ['JP'], 'convert', 'https://www.sumcosi.com/english/products/lineup.html'),
      sourced('GlobalWafers', ['TW'], 'convert', 'https://www.gw-semi.com/products/'),
      sourced('Siltronic', ['DE'], 'convert', 'https://www.siltronic.com/en/'),
      sourced('SK Siltron', ['KR'], 'convert', 'https://www.sksiltron.com/m/en/wafer/wafer.do'),
    ],
  },
  {
    material: 'Crucible-grade high-purity quartz sand',
    thesis:
      'The clearest single point of failure in the entire chain: inner-layer crucible quartz comes, in practice, from a very small number of deposits, and every Czochralski puller on earth needs it.',
    producers: [
      sourced('The Quartz Corp', ['NO', 'US'], 'mine', 'https://www.thequartzcorp.com/'),
      sourced(
        'Sibelco',
        ['BE', 'US'],
        'mine',
        'https://www.sibelco.com/en/materials/high-purity-quartz',
      ),
      sourced('Russian Quartz', ['RU'], 'mine', 'https://russianquartz.com/en/products/'),
      sourced('Jiangsu Pacific Quartz', ['CN'], 'refine', 'https://www.quartzpacificglobal.com/'),
      sourced(
        'Momentive Technologies',
        ['US'],
        'convert',
        'https://www.momentivetech.com/products/quartz',
      ),
      sourced(
        'Shin-Etsu Quartz',
        ['JP'],
        'convert',
        'https://www.shinetsu.co.jp/en/products/electronics-materials/quartz-glass-products-materials-for-quartz-glass-products/',
      ),
      lead('Ferrotec', ['JP', 'CN'], 'convert'),
    ],
  },
  {
    material: 'Gallium, refined',
    thesis:
      'A by-product of alumina refining, so primary supply cannot respond to price. Concentrated in one jurisdiction and under export control since 2023 — the textbook case for why the map matters.',
    producers: [
      lead('Chinalco', ['CN'], 'refine'),
      lead('East Hope Group', ['CN'], 'refine'),
      lead('Zhuhai Fangyuan', ['CN'], 'refine'),
      sourced(
        'Rio Tinto',
        ['CA'],
        'refine',
        'https://www.riotinto.com/en/news/releases/2025/rio-tinto-extracts-first-gallium-from-its-alumina-refining-process-with-partner-indium-corporation',
      ),
      lead('Nyrstar', ['AU'], 'refine', ['Nyrstar Australia', 'Trafigura']),
      lead('5N Plus', ['CA'], 'convert'),
    ],
  },

  // ---------- Thermal & Packaging ----------
  {
    material: 'CVD synthetic diamond heat spreader',
    thesis:
      'Reactor time, not raw material, is the constraint. Growing optical-grade polycrystalline diamond is slow, and the qualified capacity is held by a handful of firms.',
    producers: [
      sourced(
        'Element Six',
        ['GB', 'IE'],
        'convert',
        'https://www.e6.com/products/next-generation-applications',
      ),
      sourced(
        'Coherent',
        ['US'],
        'convert',
        'https://www.coherent.com/optics/crystals/bulk-optical-materials/cvd-diamond-substrates',
      ),
      sourced('Diamond Materials', ['DE'], 'convert', 'https://www.diamond-materials.com/'),
      sourced('Applied Diamond', ['US'], 'convert', 'https://usapplieddiamond.com/'),
      sourced(
        'Sumitomo Electric',
        ['JP'],
        'convert',
        'https://sumitomoelectric.com/products/cvd-diamond',
      ),
    ],
  },
  {
    material: 'Silicon carbide substrate, 200 mm semi-insulating',
    thesis:
      'The 150 mm to 200 mm transition resets everyone’s yield curve at once. Semi-insulating grade is a much smaller field than conductive SiC, and defect density is the gate.',
    producers: [
      sourced('Wolfspeed', ['US'], 'convert', 'https://www.wolfspeed.com/products/materials/'),
      sourced(
        'Coherent',
        ['US'],
        'convert',
        'https://www.coherent.com/materials/wide-bandgap-electronics/sic-substrates-epitaxy',
      ),
      sourced('SK Siltron CSS', ['KR', 'US'], 'convert', 'https://www.sksiltroncss.com/'),
      sourced(
        'Resonac',
        ['JP'],
        'convert',
        'https://www.resonac.com/products/device-solution/82/12896.html',
      ),
      sourced('SICC', ['CN'], 'convert', 'https://www.sicc.cc/en'),
      sourced('TankeBlue', ['CN'], 'convert', 'https://en.tankeblue.com/thgcd/index.html'),
    ],
  },
  {
    material: 'Two-phase dielectric immersion coolant',
    thesis:
      'A chokepoint created by regulation rather than geology: PFAS restriction is withdrawing the incumbent fluorinated chemistry precisely as immersion cooling starts to scale.',
    producers: [
      lead('3M', ['US'], 'refine'),
      lead('Chemours', ['US'], 'refine'),
      lead('Syensqo', ['BE'], 'refine', ['Solvay Specialty Polymers', 'Solvay']),
      lead('AGC', ['JP'], 'refine', ['AGC Inc', 'Asahi Glass']),
      lead('Engineered Fluids', ['US'], 'convert'),
    ],
  },

  // ---------- Power, Grid & Superconductors ----------
  {
    material: 'Grain-oriented electrical steel (GOES)',
    thesis:
      'The binding constraint on datacentre energisation. Large power transformers queue for years, and the core steel behind them is made on a small number of qualified lines.',
    producers: [
      sourced(
        'Nippon Steel',
        ['JP'],
        'convert',
        'https://www.nipponsteel.com/en/product/sheet/magnetic_sheet.html',
      ),
      sourced(
        'JFE Steel',
        ['JP'],
        'convert',
        'https://www.jfe-steel.co.jp/en/products/electrical/product/',
      ),
      sourced('POSCO', ['KR'], 'convert', 'https://www.poscointl.com/eng/steelProduct'),
      sourced(
        'ThyssenKrupp Electrical Steel',
        ['DE'],
        'convert',
        'https://www.thyssenkrupp-steel.com/de/unternehmen/business-units/electrical-steel/',
      ),
      sourced(
        'Cleveland-Cliffs',
        ['US'],
        'convert',
        'https://www.clevelandcliffs.com/operations/steelmaking/butler-works',
      ),
      sourced(
        'Baosteel',
        ['CN'],
        'convert',
        'http://www.ibaosteel.com/ibaosteel/productInfoEn/download',
      ),
      sourced(
        'Stalprodukt',
        ['PL'],
        'convert',
        'https://www.stalprodukt.com.pl/en/offer/grain-oriented-electrical-steel/',
      ),
    ],
  },
  {
    material: 'REBCO superconducting tape, 12 mm',
    thesis:
      'A single high-field fusion magnet consumes tape by the kilometre. Annual world output is small enough that one programme’s order book moves the whole market.',
    producers: [
      sourced(
        'Fujikura',
        ['JP'],
        'convert',
        'https://www.europe.fujikura.com/markets/industrial/superconductors/',
      ),
      sourced('Faraday Factory Japan', ['JP'], 'convert', 'https://www.faradaygroup.com/en/'),
      sourced('SuperPower', ['US'], 'convert', 'https://www.superpower-inc.com/specification.aspx'),
      sourced('MetOx', ['US'], 'convert', 'https://www.metoxtech.com/technology'),
      sourced('THEVA', ['DE'], 'convert', 'https://www.theva.com/products/'),
      sourced(
        'Shanghai Superconductor',
        ['CN'],
        'convert',
        'https://www.shsctec.com/en/products/tape/',
      ),
      lead('AMSC', ['US'], 'convert', ['American Superconductor', 'Amperium']),
    ],
  },
  {
    material: 'Liquid helium (He-4)',
    thesis:
      'Helium is produced only as a by-product of a few natural gas fields with unusual composition, so supply is set by unrelated gas economics and by a handful of political jurisdictions.',
    producers: [
      lead('QatarEnergy', ['QA'], 'mine'),
      sourced(
        'ExxonMobil',
        ['US'],
        'mine',
        'https://corporate.exxonmobil.com/what-we-do/materials-for-modern-living/labarge-helium-extraction-energy-production-wyoming',
      ),
      sourced('Gazprom', ['RU'], 'mine', 'http://www.gazprominfo.de/terms/orenburg-helium-plant/'),
      lead('Air Products', ['US'], 'refine'),
      lead('Linde', ['US', 'GB'], 'refine'),
      sourced('Air Liquide', ['FR'], 'refine', 'https://de.airliquide.com/unsere-gase/helium'),
    ],
  },

  // ---------- Actuation & Robotics ----------
  {
    material: 'Didymium (Nd-Pr) metal, magnet feed',
    thesis:
      'Mining is diversifying; separation and metal-making have not. The chokepoint moved downstream of the mine, which is where most published coverage still is not looking.',
    producers: [
      lead('China Northern Rare Earth', ['CN'], 'refine'),
      lead('Shenghe Resources', ['CN'], 'refine'),
      lead('Lynas Rare Earths', ['AU', 'MY'], 'refine'),
      lead('MP Materials', ['US'], 'mine'),
      lead('Neo Performance Materials', ['CA', 'EE'], 'convert'),
      lead('Solvay', ['FR'], 'refine'),
    ],
  },
  {
    material: 'Dysprosium metal',
    thesis:
      'Heavy rare earths are a far narrower chain than light ones, feedstock included. Small volumes, no substitute for hot-running magnets, and separation concentrated in effectively one jurisdiction.',
    producers: [
      lead('China Rare Earth Group', ['CN'], 'refine'),
      lead('Shenghe Resources', ['CN'], 'refine'),
      lead('Lynas Rare Earths', ['AU', 'MY'], 'refine'),
      lead('Neo Performance Materials', ['CA', 'EE'], 'convert'),
      lead('Less Common Metals', ['GB'], 'convert'),
    ],
  },
];

// =====================================================================
// PROGRESS
// =====================================================================

export interface CoverageProgress {
  /** Research leads in the universe. */
  total: number;
  /** Rows with a primary source attached — the only ones that count as covered. */
  sourced: number;
  /** Materials on the desk with no coverage entry at all. */
  uncoveredMaterials: string[];
}

/**
 * What Phase 1 completion actually means. Rows without a source are leads, so
 * a universe of 90 unsourced entries is 0% covered, not 100% mapped.
 */
export function coverageProgress(): CoverageProgress {
  const rows = COVERAGE.flatMap((entry) => entry.producers);
  const covered = new Set(COVERAGE.map((entry) => entry.material));
  return {
    total: rows.length,
    sourced: rows.filter((producer) => producer.source !== null).length,
    uncoveredMaterials: MATERIALS.map((material) => material.title).filter(
      (title) => !covered.has(title),
    ),
  };
}

/** @returns every material a company appears on — the overlaps are the point. */
export function materialsFor(companyName: string): string[] {
  return COVERAGE.filter((entry) =>
    entry.producers.some((producer) => producer.name === companyName),
  ).map((entry) => entry.material);
}

// =====================================================================
// CHOKEPOINTS THAT ARE NOT MATERIALS
//
// A material is only one kind of chokepoint, and for the compute and power
// curves it is often not the tightest one. A tool with a single supplier,
// packaging capacity allocated years ahead, a transformer order book, an
// interconnection queue and a process that lives in people rather than in
// equipment all gate the same curves — and none of them appears on a periodic
// table. The two tests do not care what a node is made of, so these enter the
// universe the same way and carry the same verification discipline: each row
// claims what the node is and why it gates, and nothing about capacity,
// share or price, because those are numbers nobody here has sourced.
// =====================================================================

export interface Chokepoint {
  name: string;
  type: NodeType;
  curve: CurveId;
  /** ISO 3166-1 alpha-2 codes where the constraint physically sits, if narrow. */
  jurisdictions: string[];
  /** Why this gates a curve. The research claim, and the whole of it. */
  why: string;
  /** Primary source. `null` = unverified research lead, exactly as above. */
  source: string | null;
}

function node(
  name: string,
  type: NodeType,
  curve: CurveId,
  jurisdictions: string[],
  why: string,
): Chokepoint {
  return { name, type, curve, jurisdictions, why, source: null };
}

/** Display label per node type, so the site never prints a raw enum. */
export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  material: 'Material',
  company: 'Company',
  person: 'People',
  machine: 'Machine',
  process: 'Process',
};

export const CHOKEPOINTS: readonly Chokepoint[] = [
  // ---------- Compute per joule ----------
  node(
    'EUV lithography scanners',
    'machine',
    'compute-per-joule',
    ['NL'],
    'One company on earth builds them, the queue is measured in years, and no second source is in progress. Every leading-edge wafer in the world is downstream of one factory.',
  ),
  node(
    'EUV projection optics',
    'process',
    'compute-per-joule',
    ['DE'],
    'The mirror systems inside the scanner are polished to a tolerance one supplier has ever achieved. It is a chokepoint inside a chokepoint, and the constraint is know-how, not capacity.',
  ),
  node(
    'Advanced packaging capacity',
    'process',
    'compute-per-joule',
    ['TW', 'KR', 'US'],
    'Accelerator output is gated by how many dies can be packaged onto an interposer, not by wafer starts. Capacity is allocated years ahead, which makes the allocation itself the scarce good.',
  ),
  node(
    'High-bandwidth memory stacking yield',
    'process',
    'compute-per-joule',
    ['KR', 'US'],
    'Three suppliers, and the yield on stacking and bonding is knowledge that does not transfer when someone else buys the same equipment.',
  ),
  node(
    'Leading-edge foundry capacity',
    'company',
    'compute-per-joule',
    ['TW', 'KR', 'US'],
    'A handful of fabs can run the newest node at volume. New capacity is a multi-year, multi-billion commitment, so the supply curve cannot answer a demand shock.',
  ),
  node(
    'Photoresist formulation',
    'process',
    'compute-per-joule',
    ['JP'],
    'The chemistry is qualified per process per fab and is overwhelmingly Japanese. Substituting a resist is a re-qualification programme, not a purchase.',
  ),
  node(
    'Semiconductor process engineers',
    'person',
    'compute-per-joule',
    [],
    'The constraint nobody can buy. A fab ramp moves at the speed of people who have done it before, which is why capacity announcements and capacity slip on different clocks.',
  ),

  // ---------- Joules delivered ----------
  node(
    'Large power transformer slots',
    'machine',
    'joules-delivered',
    ['KR', 'DE', 'JP', 'US'],
    'Lead times run to several years, and a datacentre cannot be energised without one. This gates more announced compute today than chip supply does.',
  ),
  node(
    'Grid interconnection queues',
    'process',
    'joules-delivered',
    [],
    'Not a material, not a machine, and frequently the binding constraint: a multi-year administrative queue between a signed site and a live megawatt.',
  ),
  node(
    'Heavy-duty gas turbine order books',
    'machine',
    'joules-delivered',
    ['US', 'DE'],
    'The fastest route to firm power at scale, and the order books are effectively sold out. A slot is worth more than the turbine price implies.',
  ),
  node(
    'High-voltage cable and switchgear',
    'machine',
    'joules-delivered',
    ['DE', 'IT', 'KR'],
    'The unglamorous half of energisation. Same multi-year lead times as transformers, same inability to respond quickly to a demand shock.',
  ),

  // ---------- Actuation ----------
  node(
    'Rare-earth magnet sintering',
    'process',
    'actuation',
    ['CN'],
    'Even where the metal is mined elsewhere, sintering and grain-boundary diffusion are concentrated in one jurisdiction. The chokepoint sits downstream of the mine, where most coverage is not looking.',
  ),
  node(
    'Precision reduction drives',
    'company',
    'actuation',
    ['JP'],
    'Harmonic and cycloidal drives set what a robot joint can do. Few qualified suppliers, and the tolerances are decades of accumulated manufacturing practice.',
  ),
  node(
    'Robot-grade encoders and force sensors',
    'company',
    'actuation',
    ['JP', 'DE'],
    'Closing the loop is what separates a manipulator from an arm. Narrow supply, and qualification is per-application.',
  ),
];

export interface ChokepointProgress {
  total: number;
  sourced: number;
  byCurve: Record<string, number>;
}

/** Same honesty as the producer map: a row counts only once it has a source. */
export function chokepointProgress(): ChokepointProgress {
  const byCurve: Record<string, number> = {};
  for (const point of CHOKEPOINTS) {
    byCurve[point.curve] = (byCurve[point.curve] ?? 0) + 1;
  }
  return {
    total: CHOKEPOINTS.length,
    sourced: CHOKEPOINTS.filter((point) => point.source !== null).length,
    byCurve,
  };
}
