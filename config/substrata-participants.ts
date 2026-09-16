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

// =====================================================================
// THE DIRECTORY
// =====================================================================

export const PARTICIPANTS: readonly Participant[] = [
  // ---------------- Extraction ----------------
  p(
    'The Quartz Corp',
    'extraction',
    ['NO', 'US'],
    'High-purity quartz sand',
    'chokepoint',
    'Inner-layer crucible quartz comes in practice from a very small number of deposits, and every Czochralski puller on earth needs it.',
  ),
  p(
    'Sibelco',
    'extraction',
    ['BE', 'US'],
    'High-purity quartz sand',
    'chokepoint',
    'The other holder of the same rare deposit quality. Two names deep is the whole of the upstream for this input.',
  ),
  p(
    'Sibanye-Stillwater',
    'extraction',
    ['ZA'],
    'PGM mining incl. ruthenium',
    'concentrated',
    'Ruthenium is a by-product, so its supply is set by platinum economics rather than by demand for it.',
  ),
  p(
    'Impala Platinum',
    'extraction',
    ['ZA'],
    'PGM mining',
    'concentrated',
    'Same by-product logic, same narrow geography.',
  ),
  p(
    'Nornickel',
    'extraction',
    ['RU'],
    'Nickel and PGM mining',
    'concentrated',
    'Material share of world PGM and nickel, with sanctions risk layered on top of geology.',
  ),
  p(
    'MP Materials',
    'extraction',
    ['US'],
    'Rare-earth ore',
    'concentrated',
    'The main non-Chinese light rare-earth mine. Mining diversified before separation did, which is the gap the map cares about.',
  ),
  p(
    'Lynas Rare Earths',
    'extraction',
    ['AU', 'MY'],
    'Rare-earth mining and separation',
    'concentrated',
    'The most complete non-Chinese rare-earth chain, and still small against the incumbent.',
  ),
  p(
    'Yunnan Tin',
    'extraction',
    ['CN'],
    'Tin mining and smelting',
    'concentrated',
    'Large in tin metal; the EUV-grade constraint sits downstream of it.',
  ),
  p(
    'Minsur',
    'extraction',
    ['PE'],
    'Tin mining and smelting',
    'competitive',
    'Tin metal has several credible producers. It is purity, not tonnage, that binds here.',
  ),
  p(
    'PT Timah',
    'extraction',
    ['ID'],
    'Tin mining and smelting',
    'competitive',
    'Same: the scarcity in this chain is an upgrading step, not an ore body.',
  ),
  p(
    'QatarEnergy',
    'extraction',
    ['QA'],
    'Helium from LNG',
    'concentrated',
    'Helium exists commercially only as a by-product of a few gas fields with unusual composition.',
  ),
  p(
    'ExxonMobil',
    'extraction',
    ['US'],
    'Helium from natural gas',
    'concentrated',
    'One of a very small number of fields worldwide rich enough to justify extraction.',
  ),

  // ---------------- Refining & separation ----------------
  p(
    'Wacker Chemie',
    'refining',
    ['DE', 'US'],
    'Electronic-grade polysilicon',
    'chokepoint',
    'Solar-grade polysilicon has many producers; electronic-grade has very few, and the gap is orders of magnitude of impurity.',
  ),
  p(
    'Hemlock Semiconductor',
    'refining',
    ['US'],
    'Electronic-grade polysilicon',
    'chokepoint',
    'One of a handful of qualified suppliers of the first material in the entire chain.',
  ),
  p(
    'Tokuyama',
    'refining',
    ['JP', 'MY'],
    'Electronic-grade polysilicon',
    'chokepoint',
    'Same short list, different geography — which is most of why it matters.',
  ),
  p(
    'OCI',
    'refining',
    ['KR', 'MY'],
    'Polysilicon',
    'concentrated',
    'Credible at scale, with electronic-grade a narrower qualification than volume implies.',
  ),
  p(
    'China Northern Rare Earth',
    'refining',
    ['CN'],
    'Rare-earth separation',
    'chokepoint',
    'Separation, not mining, is where the rare-earth chain actually narrows, and it narrows here.',
  ),
  p(
    'Shenghe Resources',
    'refining',
    ['CN'],
    'Rare-earth separation and trading',
    'chokepoint',
    'Processes feedstock from mines all over the world, including ones marketed as diversification.',
  ),
  p(
    'Chinalco',
    'refining',
    ['CN'],
    'Gallium from alumina refining',
    'chokepoint',
    'Gallium is an alumina by-product, so supply cannot answer price — and it is export-controlled.',
  ),
  p(
    'Heraeus',
    'refining',
    ['DE'],
    'Precious-metal refining',
    'concentrated',
    'One of the few refiners able to deliver PGMs at semiconductor purity.',
  ),
  p(
    'Johnson Matthey',
    'refining',
    ['GB'],
    'PGM refining',
    'concentrated',
    'Long-established PGM chemistry; a short list of peers worldwide.',
  ),
  p(
    'Umicore',
    'refining',
    ['BE'],
    'PGM refining and recycling',
    'concentrated',
    'Secondary supply is often the only elastic source in these metals.',
  ),
  p(
    'Linde',
    'refining',
    ['GB', 'US', 'DE'],
    'Industrial and electronic gases',
    'concentrated',
    'Noble gases come from air separation attached to heavy industry, which limits where they can come from at all.',
  ),
  p(
    'Air Liquide',
    'refining',
    ['FR'],
    'Industrial and electronic gases',
    'concentrated',
    'One of three global gas majors; the fab-qualified end is narrower than the industrial one.',
  ),
  p(
    'Air Products',
    'refining',
    ['US'],
    'Industrial gases and helium',
    'concentrated',
    'Helium distribution is a small club with long-dated source contracts.',
  ),
  p(
    'Iceblick',
    'refining',
    ['UA'],
    'Neon and rare gases',
    'concentrated',
    'The 2022 squeeze made the point: an industrial-gas map and a war map turned out to be the same map.',
  ),
  p(
    '5N Plus',
    'refining',
    ['CA', 'DE'],
    'High-purity specialty metals',
    'concentrated',
    'Upgrading to five nines and beyond is a different business from producing the metal.',
  ),

  // ---------------- Conversion ----------------
  p(
    'Shin-Etsu Handotai',
    'conversion',
    ['JP'],
    '300 mm prime silicon wafers',
    'chokepoint',
    'Five firms supply essentially all prime 300 mm capacity, and qualification at a leading-edge fab takes years.',
  ),
  p(
    'SUMCO',
    'conversion',
    ['JP'],
    '300 mm prime silicon wafers',
    'chokepoint',
    'The other half of a duopoly at the top of the wafer market.',
  ),
  p(
    'GlobalWafers',
    'conversion',
    ['TW'],
    'Silicon wafers',
    'concentrated',
    'One of the five producers tracked in the prime 300 mm wafer coverage. Relative market share has not been established here.',
  ),
  p(
    'Siltronic',
    'conversion',
    ['DE'],
    'Silicon wafers',
    'concentrated',
    'European supply of an input with almost no European alternative.',
  ),
  p(
    'SK Siltron',
    'conversion',
    ['KR'],
    'Silicon and SiC wafers',
    'concentrated',
    'Captive-adjacent to Korean memory, and one of few SiC entrants at scale.',
  ),
  p(
    'Momentive Technologies',
    'conversion',
    ['US'],
    'Fused quartz crucibles',
    'chokepoint',
    'Turning rare sand into a crucible that survives a pull is knowledge held in very few places.',
  ),
  p(
    'Shin-Etsu Quartz',
    'conversion',
    ['JP'],
    'Fused quartz components',
    'chokepoint',
    'Same step, same shortness of the list.',
  ),
  p(
    'Ferrotec',
    'conversion',
    ['JP', 'CN'],
    'Quartz and fab consumables',
    'concentrated',
    'Broad consumables base spanning both sides of an export-control line.',
  ),
  p(
    'Element Six',
    'conversion',
    ['GB', 'IE'],
    'CVD synthetic diamond',
    'concentrated',
    'Reactor time, not raw material, is the constraint on optical-grade diamond.',
  ),
  p(
    'Coherent',
    'conversion',
    ['US'],
    'SiC substrates, diamond, photonics',
    'concentrated',
    'One of the few firms present in several of this chain’s narrow materials at once.',
  ),
  p(
    'Wolfspeed',
    'conversion',
    ['US'],
    'Silicon carbide substrates',
    'concentrated',
    'The 150 to 200 mm transition resets everyone’s yield curve, which is where the scarcity currently lives.',
  ),
  p(
    'Resonac',
    'conversion',
    ['JP'],
    'SiC epitaxy and fab materials',
    'concentrated',
    'Deep in the materials nobody outside the industry can name.',
  ),
  p(
    'Fujikura',
    'conversion',
    ['JP'],
    'REBCO superconducting tape',
    'concentrated',
    'A single high-field magnet consumes tape by the kilometre against a small world output.',
  ),
  p(
    'Faraday Factory Japan',
    'conversion',
    ['JP'],
    'REBCO superconducting tape',
    'concentrated',
    'One of the very few able to ship fusion-programme quantities at all.',
  ),
  p(
    'Neo Performance Materials',
    'conversion',
    ['CA', 'EE'],
    'Rare-earth magnets and materials',
    'concentrated',
    'The main non-Chinese magnet-making capacity outside Japan, and small against demand.',
  ),
  p(
    'Less Common Metals',
    'conversion',
    ['GB'],
    'Rare-earth alloys and strip',
    'chokepoint',
    'A tiny specialist standing between Western separated oxide and a finished magnet.',
  ),
  p(
    'Nippon Steel',
    'conversion',
    ['JP'],
    'Grain-oriented electrical steel',
    'concentrated',
    'Transformer cores are made on a small number of qualified lines worldwide.',
  ),
  p(
    'POSCO',
    'conversion',
    ['KR'],
    'Grain-oriented electrical steel',
    'concentrated',
    'Same short list, and the same multi-year lead times downstream.',
  ),
  p(
    'Indium Corporation',
    'conversion',
    ['US'],
    'High-purity metals and solders',
    'concentrated',
    'Seven-nines upgrading is a specialist step with few qualified providers.',
  ),

  // ---------------- Equipment & consumables ----------------
  p(
    'ASML',
    'equipment',
    ['NL'],
    'EUV and DUV lithography systems',
    'chokepoint',
    'One company on earth builds EUV, the queue runs to years, and no second source is in progress.',
  ),
  p(
    'Carl Zeiss SMT',
    'equipment',
    ['DE'],
    'EUV projection optics',
    'chokepoint',
    'A chokepoint inside a chokepoint: the mirrors are polished to a tolerance one supplier has ever achieved.',
  ),
  p(
    'Trumpf',
    'equipment',
    ['DE'],
    'EUV plasma-source lasers',
    'chokepoint',
    'The drive laser is as single-sourced as the scanner it sits inside.',
  ),
  p(
    'Applied Materials',
    'equipment',
    ['US'],
    'Deposition, etch and process tools',
    'concentrated',
    'Broadest tool portfolio, with several steps where it is effectively the only qualified option.',
  ),
  p(
    'Lam Research',
    'equipment',
    ['US'],
    'Etch and deposition',
    'concentrated',
    'High-aspect-ratio etch for 3D memory is a narrow specialism.',
  ),
  p(
    'Tokyo Electron',
    'equipment',
    ['JP'],
    'Coaters, developers, etch',
    'concentrated',
    'Track systems pair with lithography and are qualified alongside it.',
  ),
  p(
    'KLA',
    'equipment',
    ['US'],
    'Process control and metrology',
    'concentrated',
    'You cannot yield what you cannot measure, and few can measure at this scale.',
  ),
  p(
    'ASM International',
    'equipment',
    ['NL'],
    'Atomic layer deposition',
    'concentrated',
    'ALD became unavoidable as devices went vertical, on a short supplier list.',
  ),
  p(
    'JSR',
    'equipment',
    ['JP'],
    'Photoresists',
    'chokepoint',
    'Resist chemistry is qualified per process per fab; substituting one is a programme, not a purchase.',
  ),
  p(
    'Tokyo Ohka Kogyo',
    'equipment',
    ['JP'],
    'Photoresists and process chemicals',
    'chokepoint',
    'The same Japanese concentration that made resist an export-control talking point.',
  ),
  p(
    'Shin-Etsu Chemical',
    'equipment',
    ['JP'],
    'Photoresists, masks and silicones',
    'chokepoint',
    'Present at several narrow points of this chain simultaneously.',
  ),
  p(
    'Nikon',
    'equipment',
    ['JP'],
    'Lithography systems',
    'competitive',
    'Credible in mature-node lithography, and not a factor at the leading edge — which is what "competitive" means here.',
  ),
  p(
    'Canon',
    'equipment',
    ['JP'],
    'Lithography and nanoimprint',
    'competitive',
    'An alternative path that has not yet displaced anything at volume.',
  ),

  // ---------------- Fabrication ----------------
  p(
    'TSMC',
    'fabrication',
    ['TW'],
    'Leading-edge foundry',
    'chokepoint',
    'A handful of fabs can run the newest node at volume, and one of them runs most of it.',
  ),
  p(
    'Samsung Foundry',
    'fabrication',
    ['KR'],
    'Leading-edge foundry and memory',
    'concentrated',
    'The only other merchant foundry credibly at the leading edge.',
  ),
  p(
    'Intel Foundry',
    'fabrication',
    ['US', 'IE', 'IL'],
    'Leading-edge foundry',
    'concentrated',
    'The main non-Asian leading-edge option, and the reason several policy programmes exist.',
  ),
  p(
    'SMIC',
    'fabrication',
    ['CN'],
    'Foundry',
    'concentrated',
    'Domestic Chinese capacity operating under equipment restrictions — the constraint is imported, not technical.',
  ),
  p(
    'GlobalFoundries',
    'fabrication',
    ['US', 'DE', 'SG'],
    'Mature and specialty nodes',
    'competitive',
    'Mature-node capacity is genuinely contested, which is exactly why it is not where the chain binds.',
  ),
  p(
    'UMC',
    'fabrication',
    ['TW'],
    'Mature-node foundry',
    'competitive',
    'Same: plenty of credible suppliers at these nodes.',
  ),

  // ---------------- Packaging & memory ----------------
  p(
    'TSMC Advanced Packaging',
    'packaging',
    ['TW'],
    'CoWoS-class packaging',
    'chokepoint',
    'Accelerator output is gated by packaging slots, not wafer starts, and they are allocated years ahead.',
  ),
  p(
    'ASE Technology',
    'packaging',
    ['TW'],
    'Assembly and test',
    'concentrated',
    'The largest OSAT, moving up into advanced packaging as demand overflows.',
  ),
  p(
    'Amkor',
    'packaging',
    ['US', 'KR'],
    'Assembly and test',
    'concentrated',
    'The main non-Taiwanese OSAT of scale, and a policy favourite for that reason.',
  ),
  p(
    'SK hynix',
    'packaging',
    ['KR'],
    'High-bandwidth memory',
    'chokepoint',
    'HBM stacking yield is knowledge that does not transfer when a competitor buys the same equipment.',
  ),
  p(
    'Micron',
    'packaging',
    ['US', 'JP', 'SG'],
    'High-bandwidth memory',
    'concentrated',
    'One of three, and the only one headquartered outside Korea.',
  ),
  p(
    'Samsung Memory',
    'packaging',
    ['KR'],
    'High-bandwidth memory',
    'concentrated',
    'Enormous capacity, with qualification at the top of the HBM range a separate question from volume.',
  ),

  // ---------------- Systems & silicon ----------------
  p(
    'NVIDIA',
    'systems',
    ['US'],
    'Accelerators and interconnect',
    'chokepoint',
    'The constraint is not only silicon: the software estate around it is what makes substitution slow even where alternatives exist.',
  ),
  p(
    'AMD',
    'systems',
    ['US'],
    'Accelerators and CPUs',
    'concentrated',
    'The credible merchant alternative, gated by the same packaging and memory as everyone else.',
  ),
  p(
    'Broadcom',
    'systems',
    ['US'],
    'Custom accelerators and networking silicon',
    'concentrated',
    'Most large in-house accelerator programmes run through a very short list of design partners.',
  ),
  p(
    'Marvell',
    'systems',
    ['US'],
    'Custom silicon, optics and interconnect',
    'concentrated',
    'The other name on that short list.',
  ),
  p(
    'Vertiv',
    'systems',
    ['US'],
    'Datacentre power and thermal systems',
    'concentrated',
    'Rack-level power and cooling became a constraint the moment density outran air.',
  ),
  p(
    'Arista Networks',
    'systems',
    ['US'],
    'Datacentre networking',
    'competitive',
    'Several credible suppliers of high-speed switching, and merchant silicon underneath most of them.',
  ),
  p(
    'Supermicro',
    'systems',
    ['US', 'TW'],
    'Server systems integration',
    'competitive',
    'Integration capacity is contested; the parts going into it are not.',
  ),

  // ---------------- Energy & grid ----------------
  p(
    'Hitachi Energy',
    'energy',
    ['CH', 'JP'],
    'Transformers, HVDC, grid equipment',
    'chokepoint',
    'Large power transformers run to multi-year lead times, and a datacentre cannot be energised without one.',
  ),
  p(
    'Siemens Energy',
    'energy',
    ['DE'],
    'Grid equipment and turbines',
    'chokepoint',
    'Order books for both halves of the energisation problem are effectively spoken for.',
  ),
  p(
    'GE Vernova',
    'energy',
    ['US'],
    'Gas turbines and grid equipment',
    'chokepoint',
    'The fastest route to firm power at scale, sold out well into the future.',
  ),
  p(
    'Prysmian',
    'energy',
    ['IT'],
    'High-voltage cable',
    'concentrated',
    'The unglamorous half of energisation, with the same inability to answer a demand shock quickly.',
  ),
  p(
    'NKT',
    'energy',
    ['DK'],
    'High-voltage cable',
    'concentrated',
    'A short list of firms able to make and lay HV cable at all.',
  ),
  p(
    'Schneider Electric',
    'energy',
    ['FR'],
    'Electrical distribution and datacentre power',
    'concentrated',
    'Switchgear and distribution have deepened into a constraint alongside transformers.',
  ),
  p(
    'ABB',
    'energy',
    ['CH'],
    'Electrification and drives',
    'concentrated',
    'Present on both the power and the motion side of this chain.',
  ),
  p(
    'Mitsubishi Electric',
    'energy',
    ['JP'],
    'Transformers and power electronics',
    'concentrated',
    'One of the few transformer makers with capacity outside Europe and the US.',
  ),

  // ---------------- Actuation & robotics ----------------
  p(
    'Harmonic Drive Systems',
    'actuation',
    ['JP'],
    'Strain-wave reduction gears',
    'chokepoint',
    'Precision drives set what a robot joint can do, and the tolerances are decades of accumulated practice.',
  ),
  p(
    'Nabtesco',
    'actuation',
    ['JP'],
    'Cycloidal reduction gears',
    'chokepoint',
    'The other half of a duopoly that quietly gates humanoid and industrial robotics alike.',
  ),
  p(
    'FANUC',
    'actuation',
    ['JP'],
    'Industrial robots and CNC',
    'concentrated',
    'Vertically integrated down to its own drives and controls, which is itself the moat.',
  ),
  p(
    'Yaskawa',
    'actuation',
    ['JP'],
    'Servo motors and robots',
    'concentrated',
    'Servo and drive expertise that new entrants consistently underestimate.',
  ),
  p(
    'ABB Robotics',
    'actuation',
    ['CH', 'SE'],
    'Industrial robots',
    'concentrated',
    'One of a small number of full-line robot makers worldwide.',
  ),
  p(
    'Renishaw',
    'actuation',
    ['GB'],
    'Encoders and metrology',
    'concentrated',
    'Closing the control loop precisely is a narrow specialism.',
  ),
  p(
    'KUKA',
    'actuation',
    ['DE', 'CN'],
    'Industrial robots',
    'competitive',
    'Robot assembly is contested; the drives inside are where the scarcity sits.',
  ),

  // ---------------- Deployment & demand ----------------
  p(
    'Microsoft',
    'deployment',
    ['US'],
    'Hyperscale compute buyer',
    'concentrated',
    'On the demand side the grade reads the other way: a handful of buyers account for most of the world’s accelerator orders.',
  ),
  p(
    'Amazon Web Services',
    'deployment',
    ['US'],
    'Hyperscale compute buyer and custom silicon',
    'concentrated',
    'Buys at a scale that moves supply, and designs around it where it can.',
  ),
  p(
    'Google',
    'deployment',
    ['US'],
    'Hyperscale compute buyer and custom silicon',
    'concentrated',
    'The longest-running in-house accelerator programme, and still bound by the same packaging.',
  ),
  p(
    'Meta',
    'deployment',
    ['US'],
    'Hyperscale compute buyer',
    'concentrated',
    'Among the largest single sources of demand for everything upstream of it.',
  ),
  p(
    'OpenAI',
    'deployment',
    ['US'],
    'Frontier model developer',
    'concentrated',
    'Demand large enough to be a planning input for several layers above it in this list.',
  ),
  p(
    'Anthropic',
    'deployment',
    ['US'],
    'Frontier model developer',
    'concentrated',
    'Same: frontier training demand is concentrated in very few organisations.',
  ),
  p(
    'xAI',
    'deployment',
    ['US'],
    'Frontier model developer',
    'concentrated',
    'Notable for building its own power and datacentre capacity to get around the queues.',
  ),
  p(
    'CoreWeave',
    'deployment',
    ['US'],
    'Specialist compute provider',
    'competitive',
    'Neocloud capacity is contested and growing — the constraint is what they buy, not what they sell.',
  ),
];

// =====================================================================
// VIEWS
// =====================================================================

export interface ParticipantProgress {
  total: number;
  sourced: number;
  chokepoints: number;
  concentrated: number;
  competitive: number;
  jurisdictions: number;
}

export function participantProgress(): ParticipantProgress {
  const grade = (g: ScarcityGrade) => PARTICIPANTS.filter((item) => item.scarcity === g).length;
  return {
    total: PARTICIPANTS.length,
    sourced: PARTICIPANTS.filter((item) => item.source !== null).length,
    chokepoints: grade('chokepoint'),
    concentrated: grade('concentrated'),
    competitive: grade('competitive'),
    jurisdictions: new Set(PARTICIPANTS.flatMap((item) => item.jurisdictions)).size,
  };
}

/** Participants in one layer, in the order they were written. */
export function participantsInLayer(layer: ChainLayer): Participant[] {
  return PARTICIPANTS.filter((item) => item.layer === layer);
}

/** Every participant graded a hard constraint — the point of the exercise. */
export function bindingParticipants(): Participant[] {
  return PARTICIPANTS.filter((item) => item.scarcity === 'chokepoint');
}
