/**
 * Substrata — the participants of the chain, graded by how hard they are to replace.
 *
 * The producer map answers "who makes this material". This answers the bigger
 * question: who is in the chain at all, from the ore to the buyer, and which of
 * them are actually hard to replace.
 *
 * THE SCARCITY GRADE IS THE PRODUCT
 *
 * A directory of everyone in a supply chain is a phone book. What makes this
 * research is the third column: for each participant, whether it is a
 * chokepoint, merely concentrated, or genuinely competitive. Grading some
 * participants "competitive" is not filler — it is the thing that makes
 * "chokepoint" mean something. A map where every node is critical is a map
 * that has not been read.
 *
 * The grades are the mandate's own screen (concentration, substitutability,
 * lead time, demand inelasticity) applied one participant at a time:
 *
 *   chokepoint   — one or a very few qualified suppliers, and no substitute
 *                  arrives on a horizon that matters. Removing it stops things.
 *   concentrated — a handful of credible suppliers. Substitution is possible
 *                  but slow, costly, or requires re-qualification.
 *   competitive  — many credible suppliers. Present in the chain, and not a
 *                  constraint on it.
 *
 * On the demand side the same grade reads as concentration of BUYERS: when a
 * handful of firms account for most of the world's orders, that is a scarcity
 * fact about the chain too, pointing the other way.
 *
 * Same verification discipline as everywhere else: each row claims a name, a
 * layer, a jurisdiction, a role and a scarcity judgement — and nothing about
 * revenue, capacity or share. Every row starts unsourced, which reads as a
 * research lead rather than a finding.
 *
 * Created: 2026-08-26
 */

import type { CurveId } from './substrata';

// =====================================================================
// LAYERS — ore to buyer
// =====================================================================

export type ChainLayer =
  | 'extraction'
  | 'refining'
  | 'conversion'
  | 'equipment'
  | 'fabrication'
  | 'packaging'
  | 'systems'
  | 'energy'
  | 'actuation'
  | 'deployment';

export interface ChainLayerSpec {
  id: ChainLayer;
  name: string;
  curve: CurveId;
  detail: string;
}

/** Ordered upstream to downstream. The order is the chain. */
export const CHAIN_LAYERS: readonly ChainLayerSpec[] = [
  {
    id: 'extraction',
    name: 'Extraction',
    curve: 'compute-per-joule',
    detail: 'Ore, gas fields and the by-product streams that most of these elements come from.',
  },
  {
    id: 'refining',
    name: 'Refining & separation',
    curve: 'compute-per-joule',
    detail:
      'Purification to the grade an application needs. For most of this chain the chokepoint moved here long ago, downstream of the mine and out of view.',
  },
  {
    id: 'conversion',
    name: 'Conversion',
    curve: 'compute-per-joule',
    detail: 'Into the form that ships: wafer, crucible, tape, coil, target, magnet.',
  },
  {
    id: 'equipment',
    name: 'Equipment & consumables',
    curve: 'compute-per-joule',
    detail:
      'The tools that print, etch, deposit and measure — and the chemistry they consume doing it.',
  },
  {
    id: 'fabrication',
    name: 'Fabrication',
    curve: 'compute-per-joule',
    detail: 'The fabs. Where a design becomes a die, at a node and a yield.',
  },
  {
    id: 'packaging',
    name: 'Packaging & memory',
    curve: 'compute-per-joule',
    detail:
      'Where dies become an accelerator. Increasingly the step that gates output rather than wafer starts.',
  },
  {
    id: 'systems',
    name: 'Systems & silicon',
    curve: 'compute-per-joule',
    detail: 'Accelerators, interconnect and the machines they are built into.',
  },
  {
    id: 'energy',
    name: 'Energy & grid',
    curve: 'joules-delivered',
    detail:
      'Transformers, turbines, cable and switchgear. The layer that decides whether announced compute is ever energised.',
  },
  {
    id: 'actuation',
    name: 'Actuation & robotics',
    curve: 'actuation',
    detail: 'Drives, motors, encoders and the robots they add up to.',
  },
  {
    id: 'deployment',
    name: 'Deployment & demand',
    curve: 'compute-per-joule',
    detail:
      'Who is actually buying. Concentrated demand is a scarcity fact about a chain in its own right.',
  },
];

// =====================================================================
// SCARCITY
// =====================================================================

export type ScarcityGrade = 'chokepoint' | 'concentrated' | 'competitive';

export const SCARCITY_LABEL: Record<ScarcityGrade, string> = {
  chokepoint: 'Chokepoint',
  concentrated: 'Concentrated',
  competitive: 'Competitive',
};

export const SCARCITY_DETAIL: Record<ScarcityGrade, string> = {
  chokepoint:
    'One or very few qualified suppliers, and no substitute on a horizon that matters. Removing it stops things.',
  concentrated:
    'A handful of credible suppliers. Substitution is possible but slow, costly, or needs re-qualification.',
  competitive:
    'Many credible suppliers. In the chain, but not a constraint on it — and saying so is what makes the other two grades mean something.',
};

export interface Participant {
  name: string;
  layer: ChainLayer;
  jurisdictions: string[];
  /** What they do in the chain, in one line. */
  role: string;
  scarcity: ScarcityGrade;
  /** Why the grade — the research claim, and the whole of it. */
  why: string;
  /** Primary source. `null` = unverified research lead, as everywhere else. */
  source: string | null;
}

// Unused as of 2026-09-21: a pass sourced every row in the directory below,
// so nothing currently calls this. Kept rather than deleted — the header
// above is explicit that a new participant starts as an unverified lead, and
// this is the helper that makes one. Delete it only if that stops being true.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function p(
  name: string,
  layer: ChainLayer,
  jurisdictions: string[],
  role: string,
  scarcity: ScarcityGrade,
  why: string,
): Participant {
  return { name, layer, jurisdictions, role, scarcity, why, source: null };
}

/**
 * A row an analyst has confirmed: the source is the organisation's own page
 * (or an equally direct filing or trade-press account) stating this role.
 * Same discipline as `sourced()` in `substrata-coverage.ts` — the scarcity
 * grade is still a judgement, never claimed as sourced by this; only the
 * name, layer, jurisdiction and role are.
 */
function s(
  name: string,
  layer: ChainLayer,
  jurisdictions: string[],
  role: string,
  scarcity: ScarcityGrade,
  why: string,
  source: string,
): Participant {
  return { name, layer, jurisdictions, role, scarcity, why, source };
}

// =====================================================================
// THE DIRECTORY
// =====================================================================

export const PARTICIPANTS: readonly Participant[] = [
  // ---------------- Extraction ----------------
  s(
    'The Quartz Corp',
    'extraction',
    ['NO', 'US'],
    'High-purity quartz sand',
    'chokepoint',
    'Inner-layer crucible quartz comes in practice from a very small number of deposits, and every Czochralski puller on earth needs it.',
    'https://www.thequartzcorp.com/high-purity-quartz',
  ),
  s(
    'Sibelco',
    'extraction',
    ['BE', 'US'],
    'High-purity quartz sand',
    'chokepoint',
    'The other holder of the same rare deposit quality. Two names deep is the whole of the upstream for this input.',
    'https://www.sibelco.com/en/materials/high-purity-quartz',
  ),
  s(
    'Sibanye-Stillwater',
    'extraction',
    ['ZA'],
    'PGM mining incl. ruthenium',
    'concentrated',
    'Ruthenium is a by-product, so its supply is set by platinum economics rather than by demand for it.',
    'https://www.sec.gov/Archives/edgar/data/1786909/000178690925000028/senstradingupdateh12025.htm',
  ),
  s(
    'Impala Platinum',
    'extraction',
    ['ZA'],
    'PGM mining',
    'concentrated',
    'Same by-product logic, same narrow geography.',
    'https://www.forbes.com/companies/impala-platinum-holdings/',
  ),
  s(
    'Nornickel',
    'extraction',
    ['RU'],
    'Nickel and PGM mining',
    'concentrated',
    'Material share of world PGM and nickel, with sanctions risk layered on top of geology.',
    'https://nornickel.com/company/about/',
  ),
  s(
    'MP Materials',
    'extraction',
    ['US'],
    'Rare-earth ore',
    'concentrated',
    'The main non-Chinese light rare-earth mine. Mining diversified before separation did, which is the gap the map cares about.',
    'https://mpmaterials.com/mountain-pass',
  ),
  s(
    'Lynas Rare Earths',
    'extraction',
    ['AU', 'MY'],
    'Rare-earth mining and separation',
    'concentrated',
    'The most complete non-Chinese rare-earth chain, and still small against the incumbent.',
    'https://lynasrareearths.com/about-us/about-lynas-rare-earths/',
  ),
  s(
    'Yunnan Tin',
    'extraction',
    ['CN'],
    'Tin mining and smelting',
    'concentrated',
    'Large in tin metal; the EUV-grade constraint sits downstream of it.',
    'https://en.ytc.cn/',
  ),
  s(
    'Minsur',
    'extraction',
    ['PE'],
    'Tin mining and smelting',
    'competitive',
    'Tin metal has several credible producers. It is purity, not tonnage, that binds here.',
    'https://www.internationaltin.org/tag/minsur/',
  ),
  s(
    'PT Timah',
    'extraction',
    ['ID'],
    'Tin mining and smelting',
    'competitive',
    'Same: the scarcity in this chain is an upgrading step, not an ore body.',
    'https://timah.com/blog/about-us/processing-smelting',
  ),
  s(
    'QatarEnergy',
    'extraction',
    ['QA'],
    'Helium from LNG',
    'concentrated',
    'Helium exists commercially only as a by-product of a few gas fields with unusual composition.',
    'https://www.gulf-times.com/story/358882/New-plant-takes-Qatar-to-top-spot-in-helium-export',
  ),
  s(
    'ExxonMobil',
    'extraction',
    ['US'],
    'Helium from natural gas',
    'concentrated',
    'One of a very small number of fields worldwide rich enough to justify extraction.',
    'https://corporate.exxonmobil.com/what-we-do/materials-for-modern-living/labarge-helium-extraction-energy-production-wyoming',
  ),

  // ---------------- Refining & separation ----------------
  s(
    'Wacker Chemie',
    'refining',
    ['DE', 'US'],
    'Electronic-grade polysilicon',
    'chokepoint',
    'Solar-grade polysilicon has many producers; electronic-grade has very few, and the gap is orders of magnitude of impurity.',
    'https://www.wacker.com/cms/de-de/products/brands/polysilicon/polysilicon.html',
  ),
  s(
    'Hemlock Semiconductor',
    'refining',
    ['US'],
    'Electronic-grade polysilicon',
    'chokepoint',
    'One of a handful of qualified suppliers of the first material in the entire chain.',
    'https://www.hscpoly.com/markets-technologies/electronics/',
  ),
  s(
    'Tokuyama',
    'refining',
    ['JP', 'MY'],
    'Electronic-grade polysilicon',
    'chokepoint',
    'Same short list, different geography — which is most of why it matters.',
    'https://www.tokuyama.co.jp/eng/products/electronic_materials/polysilicon.html',
  ),
  s(
    'OCI',
    'refining',
    ['KR', 'MY'],
    'Polysilicon',
    'concentrated',
    'Credible at scale, with electronic-grade a narrower qualification than volume implies.',
    'https://www.oci.co.kr/en/products/semiconductor/polysilicon',
  ),
  s(
    'China Northern Rare Earth',
    'refining',
    ['CN'],
    'Rare-earth separation',
    'chokepoint',
    'Separation, not mining, is where the rare-earth chain actually narrows, and it narrows here.',
    'https://www.metalnomist.com/2024/11/china-launches-worlds-largest-rare.html',
  ),
  s(
    'Shenghe Resources',
    'refining',
    ['CN'],
    'Rare-earth separation and trading',
    'chokepoint',
    'Processes feedstock from mines all over the world, including ones marketed as diversification.',
    'https://magneticsmag.com/shenghe-to-acquire-neos-separation-assets-in-china-for-30-million-backs-peaks-tanzania-project-for-96-million/',
  ),
  // Same entity correction as `substrata-coverage.ts`: Chalco (Aluminum
  // Corporation of China Limited) runs the alumina refineries, not the
  // unlisted parent group "Chinalco" trade press often shorthands it as.
  s(
    'Chalco',
    'refining',
    ['CN'],
    'Gallium from alumina refining',
    'chokepoint',
    'Gallium is an alumina by-product, so supply cannot answer price — and it is export-controlled.',
    'https://www.mining.com/web/chalco-injects-gallium-assets-into-rare-earths-affiliate/',
  ),
  s(
    'Heraeus',
    'refining',
    ['DE'],
    'Precious-metal refining',
    'concentrated',
    'One of the few refiners able to deliver PGMs at semiconductor purity.',
    'https://www.heraeus-precious-metals.com/de/products-solutions/metal/ruthenium/',
  ),
  s(
    'Johnson Matthey',
    'refining',
    ['GB'],
    'PGM refining',
    'concentrated',
    'Long-established PGM chemistry; a short list of peers worldwide.',
    'https://matthey.com/products-and-markets/pgms-and-circularity/pgm-markets/ruthenium',
  ),
  s(
    'Umicore',
    'refining',
    ['BE'],
    'PGM refining and recycling',
    'concentrated',
    'Secondary supply is often the only elastic source in these metals.',
    'https://www.umicore.com/en/markets-products/metals/ruthenium/about/',
  ),
  s(
    'Linde',
    'refining',
    ['GB', 'US', 'DE'],
    'Industrial and electronic gases',
    'concentrated',
    'Noble gases come from air separation attached to heavy industry, which limits where they can come from at all.',
    'https://www.gulf-times.com/story/358882/New-plant-takes-Qatar-to-top-spot-in-helium-export',
  ),
  s(
    'Air Liquide',
    'refining',
    ['FR'],
    'Industrial and electronic gases',
    'concentrated',
    'One of three global gas majors; the fab-qualified end is narrower than the industrial one.',
    'https://uk.airliquide.com/gases-and-products/neon',
  ),
  s(
    'Air Products',
    'refining',
    ['US'],
    'Industrial gases and helium',
    'concentrated',
    'Helium distribution is a small club with long-dated source contracts.',
    'https://www.airproducts.com/gases/helium',
  ),
  s(
    'Iceblick',
    'refining',
    ['UA'],
    'Neon and rare gases',
    'concentrated',
    'The 2022 squeeze made the point: an industrial-gas map and a war map turned out to be the same map.',
    'https://spie.org/news/photonics-focus/mayjune-2023/supplying-noble-gases-for-photonics-in-war-time',
  ),
  s(
    '5N Plus',
    'refining',
    ['CA', 'DE'],
    'High-purity specialty metals',
    'concentrated',
    'Upgrading to five nines and beyond is a different business from producing the metal.',
    'https://www.5nplus.com/en/investors/overview/',
  ),

  // ---------------- Conversion ----------------
  s(
    'Shin-Etsu Handotai',
    'conversion',
    ['JP'],
    '300 mm prime silicon wafers',
    'chokepoint',
    'One of the five prime 300 mm wafer producers tracked in this corpus. Global market share and customer qualification timelines are not established by the linked product source.',
    'https://www.shinetsu.co.jp/en/products/semiconductor-silicon-business/',
  ),
  s(
    'SUMCO',
    'conversion',
    ['JP'],
    '300 mm prime silicon wafers',
    'chokepoint',
    'The other half of a duopoly at the top of the wafer market.',
    'https://www.sumcosi.com/english/products/lineup.html',
  ),
  s(
    'GlobalWafers',
    'conversion',
    ['TW'],
    'Silicon wafers',
    'concentrated',
    'One of the five producers tracked in the prime 300 mm wafer coverage. Relative market share has not been established here.',
    'https://www.gw-semi.com/products/',
  ),
  s(
    'Siltronic',
    'conversion',
    ['DE'],
    'Silicon wafers',
    'concentrated',
    'European supply of an input with almost no European alternative.',
    'https://www.siltronic.com/en/products.html',
  ),
  s(
    'SK Siltron',
    'conversion',
    ['KR'],
    'Silicon and SiC wafers',
    'concentrated',
    'Captive-adjacent to Korean memory, and one of few SiC entrants at scale.',
    'https://www.sksiltron.com/m/en/wafer/waferC.do',
  ),
  s(
    'Momentive Technologies',
    'conversion',
    ['US'],
    'Fused quartz crucibles',
    'chokepoint',
    'Turning rare sand into a crucible that survives a pull is knowledge held in very few places.',
    'https://www.momentivetech.com/products/crucibles/quartz-glass-crucibles',
  ),
  s(
    'Shin-Etsu Quartz',
    'conversion',
    ['JP'],
    'Fused quartz components',
    'chokepoint',
    'Same step, same shortness of the list.',
    'https://www.shinetsu.co.jp/en/products/electronics-materials/quartz-glass-products-materials-for-quartz-glass-products/',
  ),
  s(
    'Ferrotec',
    'conversion',
    ['JP', 'CN'],
    'Quartz and fab consumables',
    'concentrated',
    'Broad consumables base spanning both sides of an export-control line.',
    'https://www.ferrotec.com/products-technologies/fabricated-quartzware/',
  ),
  s(
    'Element Six',
    'conversion',
    ['GB', 'IE'],
    'CVD synthetic diamond',
    'concentrated',
    'Reactor time, not raw material, is the constraint on optical-grade diamond.',
    'https://www.e6.com/products/next-generation-applications',
  ),
  s(
    'Coherent',
    'conversion',
    ['US'],
    'SiC substrates, diamond, photonics',
    'concentrated',
    'One of the few firms present in several of this chain’s narrow materials at once.',
    'https://www.coherent.com/materials/wide-bandgap-electronics/sic-substrates-epitaxy',
  ),
  s(
    'Wolfspeed',
    'conversion',
    ['US'],
    'Silicon carbide substrates',
    'concentrated',
    'The 150 to 200 mm transition resets everyone’s yield curve, which is where the scarcity currently lives.',
    'https://www.wolfspeed.com/products/materials/',
  ),
  s(
    'Resonac',
    'conversion',
    ['JP'],
    'SiC epitaxy and fab materials',
    'concentrated',
    'Deep in the materials nobody outside the industry can name.',
    'https://www.resonac.com/products/device-solution/82/12896.html',
  ),
  s(
    'Fujikura',
    'conversion',
    ['JP'],
    'REBCO superconducting tape',
    'concentrated',
    'A single high-field magnet consumes tape by the kilometre against a small world output.',
    'https://www.europe.fujikura.com/markets/industrial/superconductors/',
  ),
  s(
    'Faraday Factory Japan',
    'conversion',
    ['JP'],
    'REBCO superconducting tape',
    'concentrated',
    'One of the very few able to ship fusion-programme quantities at all.',
    'https://www.faradaygroup.com/en/',
  ),
  s(
    'Neo Performance Materials',
    'conversion',
    ['CA', 'EE'],
    'Rare-earth magnets and materials',
    'concentrated',
    'The main non-Chinese magnet-making capacity outside Japan, and small against demand.',
    'https://www.neomaterials.com/neo-performance-materials-opens-state-of-the-art-permanent-magnet-facility-in-europe/',
  ),
  s(
    'Less Common Metals',
    'conversion',
    ['GB'],
    'Rare-earth alloys and strip',
    'chokepoint',
    'A tiny specialist standing between Western separated oxide and a finished magnet.',
    'https://lesscommonmetals.com/our-services/',
  ),
  s(
    'Nippon Steel',
    'conversion',
    ['JP'],
    'Grain-oriented electrical steel',
    'concentrated',
    'Transformer cores are made on a small number of qualified lines worldwide.',
    'https://www.nipponsteel.com/en/product/sheet/magnetic_sheet.html',
  ),
  s(
    'POSCO',
    'conversion',
    ['KR'],
    'Grain-oriented electrical steel',
    'concentrated',
    'Same short list, and the same multi-year lead times downstream.',
    'https://www.poscointl.com/eng/steelProduct',
  ),
  s(
    'Indium Corporation',
    'conversion',
    ['US'],
    'High-purity metals and solders',
    'concentrated',
    'Seven-nines upgrading is a specialist step with few qualified providers.',
    'https://www.indium.com/products/metals/tin/',
  ),

  // ---------------- Equipment & consumables ----------------
  s(
    'ASML',
    'equipment',
    ['NL'],
    'EUV and DUV lithography systems',
    'chokepoint',
    'One company on earth builds EUV, its order backlog is measured in tens of billions of euros, and no second source is in progress.',
    'https://www.asml.com/en/products',
  ),
  s(
    'Carl Zeiss SMT',
    'equipment',
    ['DE'],
    'EUV projection optics',
    'chokepoint',
    'A chokepoint inside a chokepoint: the mirrors are polished to a tolerance one supplier has ever achieved.',
    'https://www.zeiss.com/semiconductor-manufacturing-technology/products.html',
  ),
  s(
    'Trumpf',
    'equipment',
    ['DE'],
    'EUV plasma-source lasers',
    'chokepoint',
    'The drive laser is as single-sourced as the scanner it sits inside.',
    'https://www.trumpf.com/en_US/products/lasers/euv-drive-laser/',
  ),
  s(
    'Applied Materials',
    'equipment',
    ['US'],
    'Deposition, etch and process tools',
    'concentrated',
    'Broadest tool portfolio, with several steps where it is effectively the only qualified option.',
    'https://ir.appliedmaterials.com/news-releases/news-release-details/applied-materials-ranked-number-one-etch-supplier',
  ),
  s(
    'Lam Research',
    'equipment',
    ['US'],
    'Etch and deposition',
    'concentrated',
    'High-aspect-ratio etch for 3D memory is a narrow specialism.',
    'https://www.lamresearch.com/products/',
  ),
  s(
    'Tokyo Electron',
    'equipment',
    ['JP'],
    'Coaters, developers, etch',
    'concentrated',
    'Track systems pair with lithography and are qualified alongside it.',
    'https://www.tel.com/product/',
  ),
  s(
    'KLA',
    'equipment',
    ['US'],
    'Process control and metrology',
    'concentrated',
    'You cannot yield what you cannot measure, and few can measure at this scale.',
    'https://www.kla.com/products/oem/process-control',
  ),
  s(
    'ASM International',
    'equipment',
    ['NL'],
    'Atomic layer deposition',
    'concentrated',
    'ALD became unavoidable as devices went vertical, on a short supplier list.',
    'https://www.asm.com/our-technology-products/ald',
  ),
  s(
    'JSR',
    'equipment',
    ['JP'],
    'Photoresists',
    'chokepoint',
    'Resist chemistry is qualified per process per fab; substituting one is a programme, not a purchase.',
    'https://www.jsr.co.jp/jsr_e/products/em/',
  ),
  s(
    'Tokyo Ohka Kogyo',
    'equipment',
    ['JP'],
    'Photoresists and process chemicals',
    'chokepoint',
    'The same Japanese concentration that made resist an export-control talking point.',
    'https://www.tok-pr.com/en/products/photoresist.html',
  ),
  s(
    'Shin-Etsu Chemical',
    'equipment',
    ['JP'],
    'Photoresists, masks and silicones',
    'chokepoint',
    'Present at several narrow points of this chain simultaneously.',
    'https://www.shinetsu.co.jp/en/products/electronics-materials/photomask-blanks/',
  ),
  s(
    'Nikon',
    'equipment',
    ['JP'],
    'Lithography systems',
    'competitive',
    'Credible in mature-node lithography, and not a factor at the leading edge — which is what "competitive" means here.',
    'https://www.nikon.com/products/semi/',
  ),
  s(
    'Canon',
    'equipment',
    ['JP'],
    'Lithography and nanoimprint',
    'competitive',
    'An alternative path that has not yet displaced anything at volume.',
    'https://global.canon/en/product/indtech/semicon/',
  ),

  // ---------------- Fabrication ----------------
  s(
    'TSMC',
    'fabrication',
    ['TW'],
    'Leading-edge foundry',
    'chokepoint',
    'A handful of fabs can run the newest node at volume, and one of them runs most of it.',
    'https://www.tsmc.com/english/dedicatedFoundry/technology/logic',
  ),
  s(
    'Samsung Foundry',
    'fabrication',
    ['KR'],
    'Leading-edge foundry and memory',
    'concentrated',
    'The only other merchant foundry credibly at the leading edge.',
    'https://semiconductor.samsung.com/foundry/process-technology/',
  ),
  s(
    'Intel Foundry',
    'fabrication',
    ['US', 'IE', 'IL'],
    'Leading-edge foundry',
    'concentrated',
    'The main non-Asian leading-edge option, and the reason several policy programmes exist.',
    'https://www.intel.com/content/www/us/en/foundry/process.html',
  ),
  s(
    'SMIC',
    'fabrication',
    ['CN'],
    'Foundry',
    'concentrated',
    'Domestic Chinese capacity operating under equipment restrictions — the constraint is imported, not technical.',
    'https://www.smics.com/en/',
  ),
  s(
    'GlobalFoundries',
    'fabrication',
    ['US', 'DE', 'SG'],
    'Mature and specialty nodes',
    'competitive',
    'Mature-node capacity is genuinely contested, which is exactly why it is not where the chain binds.',
    'https://gf.com/technology-platforms/',
  ),
  s(
    'UMC',
    'fabrication',
    ['TW'],
    'Mature-node foundry',
    'competitive',
    'Same: plenty of credible suppliers at these nodes.',
    'https://www.umc.com/en/Product/technologies/Index/logic',
  ),

  // ---------------- Packaging & memory ----------------
  s(
    'TSMC Advanced Packaging',
    'packaging',
    ['TW'],
    'CoWoS-class packaging',
    'chokepoint',
    'Accelerator output is gated by packaging slots, not wafer starts, and they are allocated ahead and still short of demand.',
    'https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm',
  ),
  s(
    'ASE Technology',
    'packaging',
    ['TW'],
    'Assembly and test',
    'concentrated',
    'The largest OSAT, moving up into advanced packaging as demand overflows.',
    'https://ase.aseglobal.com/test-services/',
  ),
  s(
    'Amkor',
    'packaging',
    ['US', 'KR'],
    'Assembly and test',
    'concentrated',
    'The main non-Taiwanese OSAT of scale, and a policy favourite for that reason.',
    'https://amkor.com/test-services/',
  ),
  s(
    'SK hynix',
    'packaging',
    ['KR'],
    'High-bandwidth memory',
    'chokepoint',
    'HBM stacking yield is knowledge that does not transfer when a competitor buys the same equipment.',
    'https://product.skhynix.com/products/dram/hbm/hbm3.go?appTypCd=APX01&treeNo=1109',
  ),
  s(
    'Micron',
    'packaging',
    ['US', 'JP', 'SG'],
    'High-bandwidth memory',
    'concentrated',
    'One of three, and the only one headquartered outside Korea.',
    'https://www.micron.com/products/memory/hbm',
  ),
  s(
    'Samsung Memory',
    'packaging',
    ['KR'],
    'High-bandwidth memory',
    'concentrated',
    'Enormous capacity, with qualification at the top of the HBM range a separate question from volume.',
    'https://semiconductor.samsung.com/dram/hbm/',
  ),

  // ---------------- Systems & silicon ----------------
  s(
    'NVIDIA',
    'systems',
    ['US'],
    'Accelerators and interconnect',
    'chokepoint',
    'The constraint is not only silicon: the software estate around it is what makes substitution slow even where alternatives exist.',
    'https://www.nvidia.com/en-us/data-center/products/',
  ),
  s(
    'AMD',
    'systems',
    ['US'],
    'Accelerators and CPUs',
    'concentrated',
    'The credible merchant alternative, gated by the same packaging and memory as everyone else.',
    'https://www.amd.com/en/products/accelerators/instinct/mi300.html',
  ),
  s(
    'Broadcom',
    'systems',
    ['US'],
    'Custom accelerators and networking silicon',
    'concentrated',
    'Most large in-house accelerator programmes run through a very short list of design partners.',
    'https://www.broadcom.com/products/custom-silicon/asics',
  ),
  s(
    'Marvell',
    'systems',
    ['US'],
    'Custom silicon, optics and interconnect',
    'concentrated',
    'The other name on that short list.',
    'https://www.marvell.com/solutions/data-center/optical-dsp.html',
  ),
  s(
    'Vertiv',
    'systems',
    ['US'],
    'Datacentre power and thermal systems',
    'concentrated',
    'Rack-level power and cooling became a constraint the moment density outran air.',
    'https://www.vertiv.com/en-us/products/thermal-management/cooling/',
  ),
  s(
    'Arista Networks',
    'systems',
    ['US'],
    'Datacentre networking',
    'competitive',
    'Several credible suppliers of high-speed switching, and merchant silicon underneath most of them.',
    'https://www.arista.com/en/products',
  ),
  s(
    'Supermicro',
    'systems',
    ['US', 'TW'],
    'Server systems integration',
    'competitive',
    'Integration capacity is contested; the parts going into it are not.',
    'https://www.supermicro.com/en/solutions/ai-deep-learning',
  ),

  // ---------------- Energy & grid ----------------
  s(
    'Hitachi Energy',
    'energy',
    ['CH', 'JP'],
    'Transformers, HVDC, grid equipment',
    'chokepoint',
    'Large power transformers run to multi-year lead times, and a datacentre cannot be energised without one.',
    'https://www.hitachienergy.com/us/en/products-and-solutions/transformers/power-transformers',
  ),
  s(
    'Siemens Energy',
    'energy',
    ['DE'],
    'Grid equipment and turbines',
    'chokepoint',
    'Order books for both halves of the energisation problem are effectively spoken for.',
    'https://www.siemens-energy.com/global/en/home/products-services/product-offerings/gas-turbines.html',
  ),
  s(
    'GE Vernova',
    'energy',
    ['US'],
    'Gas turbines and grid equipment',
    'chokepoint',
    'The fastest route to firm power at scale, with an order book years ahead of what it can build.',
    'https://www.gevernova.com/gas-power/products/gas-turbines',
  ),
  s(
    'Prysmian',
    'energy',
    ['IT'],
    'High-voltage cable',
    'concentrated',
    'The unglamorous half of energisation, with the same inability to answer a demand shock quickly.',
    'https://www.prysmian.com/en',
  ),
  s(
    'NKT',
    'energy',
    ['DK'],
    'High-voltage cable',
    'concentrated',
    'A short list of firms able to make and lay HV cable at all.',
    'https://www.nkt.us/products-solutions/high-voltage-cable-solutions',
  ),
  s(
    'Schneider Electric',
    'energy',
    ['FR'],
    'Electrical distribution and datacentre power',
    'concentrated',
    'Switchgear and distribution have deepened into a constraint alongside transformers.',
    'https://www.se.com/us/en/work/products/critical-power-cooling-and-racks/',
  ),
  s(
    'ABB',
    'energy',
    ['CH'],
    'Electrification and drives',
    'concentrated',
    'Present on both the power and the motion side of this chain.',
    'https://www.abb.com/global/en/areas/motion/drives',
  ),
  s(
    'Mitsubishi Electric',
    'energy',
    ['JP'],
    'Transformers and power electronics',
    'concentrated',
    'One of the few transformer makers with capacity outside Europe and the US.',
    'https://www.mitsubishielectric.com/eig/energysystems/products/transmission/transformers/',
  ),

  // ---------------- Actuation & robotics ----------------
  s(
    'Harmonic Drive Systems',
    'actuation',
    ['JP'],
    'Strain-wave reduction gears',
    'chokepoint',
    'Precision drives set what a robot joint can do, and the tolerances are decades of accumulated practice.',
    'https://www.harmonicdrive.net/technology/harmonicdrive',
  ),
  s(
    'Nabtesco',
    'actuation',
    ['JP'],
    'Cycloidal reduction gears',
    'chokepoint',
    'The other half of a duopoly that quietly gates humanoid and industrial robotics alike.',
    'https://precision.nabtesco.com/en/products/',
  ),
  s(
    'FANUC',
    'actuation',
    ['JP'],
    'Industrial robots and CNC',
    'concentrated',
    'Vertically integrated down to its own drives and controls, which is itself the moat.',
    'https://www.fanucamerica.com/products',
  ),
  s(
    'Yaskawa',
    'actuation',
    ['JP'],
    'Servo motors and robots',
    'concentrated',
    'Servo and drive expertise that new entrants consistently underestimate.',
    'https://www.yaskawa-global.com/product/robotics',
  ),
  s(
    'ABB Robotics',
    'actuation',
    ['CH', 'SE'],
    'Industrial robots',
    'concentrated',
    'One of a small number of full-line robot makers worldwide.',
    'https://www.abb.com/global/en/areas/robotics/products/robots',
  ),
  s(
    'Renishaw',
    'actuation',
    ['GB'],
    'Encoders and metrology',
    'concentrated',
    'Closing the control loop precisely is a narrow specialism.',
    'https://www.renishaw.com/en/encoders-for-position-and-motion-control--6331',
  ),
  s(
    'KUKA',
    'actuation',
    ['DE', 'CN'],
    'Industrial robots',
    'competitive',
    'Robot assembly is contested; the drives inside are where the scarcity sits.',
    'https://www.kuka.com/en-us/products/robotics-systems/industrial-robots',
  ),

  // ---------------- Deployment & demand ----------------
  s(
    'Microsoft',
    'deployment',
    ['US'],
    'Hyperscale compute buyer',
    'concentrated',
    'On the demand side the grade reads the other way: a handful of buyers account for most of the world’s accelerator orders.',
    'https://azure.microsoft.com/en-us/solutions/high-performance-computing/ai-infrastructure',
  ),
  s(
    'Amazon Web Services',
    'deployment',
    ['US'],
    'Hyperscale compute buyer and custom silicon',
    'concentrated',
    'Buys at a scale that moves supply, and designs around it where it can.',
    'https://aws.amazon.com/silicon-innovation/',
  ),
  s(
    'Google',
    'deployment',
    ['US'],
    'Hyperscale compute buyer and custom silicon',
    'concentrated',
    'The longest-running in-house accelerator programme, and still bound by the same packaging.',
    'https://cloud.google.com/tpu',
  ),
  s(
    'Meta',
    'deployment',
    ['US'],
    'Hyperscale compute buyer',
    'concentrated',
    'Among the largest single sources of demand for everything upstream of it.',
    'https://engineering.fb.com/2024/03/12/data-center-engineering/building-metas-genai-infrastructure/',
  ),
  s(
    'OpenAI',
    'deployment',
    ['US'],
    'Frontier model developer',
    'concentrated',
    'Demand large enough to be a planning input for several layers above it in this list.',
    'https://openai.com/index/building-the-compute-infrastructure-for-the-intelligence-age/',
  ),
  s(
    'Anthropic',
    'deployment',
    ['US'],
    'Frontier model developer',
    'concentrated',
    'Same: frontier training demand is concentrated in very few organisations.',
    'https://www.anthropic.com/claude',
  ),
  s(
    'xAI',
    'deployment',
    ['US'],
    'Frontier model developer',
    'concentrated',
    'Notable for building its own power and datacentre capacity to get around the queues.',
    'https://www.datacenterfrontier.com/machine-learning/article/55244139/the-colossus-ai-supercomputer-elon-musks-drive-toward-data-center-ai-technology-domination',
  ),
  s(
    'CoreWeave',
    'deployment',
    ['US'],
    'Specialist compute provider',
    'competitive',
    'Neocloud capacity is contested and growing — the constraint is what they buy, not what they sell.',
    'https://www.coreweave.com/why-coreweave',
  ),
];
