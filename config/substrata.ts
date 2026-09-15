/**
 * "Substrata" — OrangeCat-side SSOT
 *
 * An open-source research firm covering the chokepoints between here and a
 * technological singularity. Intelligence is not made of software. It is made
 * of purified tin, neon and rare-earth metal — and also of EUV scanners nobody
 * else can build, packaging capacity allocated years ahead, transformer slots,
 * grid queues, and process knowledge that does not transfer with a purchase
 * order. Behind each is a lead time and a dependency almost nobody has written
 * down in public.
 *
 * THE PRODUCT IS THE MAP. There is NO TRADING DESK, and this file must not
 * imply one: standing a regulated commodities book up is a long road through
 * licensing, and until it is walked, publishing prices or inviting enquiries to
 * deal would advertise a capability that does not exist. Research, data and intel are
 * the whole of the business today. When a desk exists it will be added here
 * with the disclosure rules that already sit below, written in advance
 * precisely so they cannot look like a reaction later.
 *
 * This file is the single source of truth for the firm's identity, its mandate
 * (the tests that make "focused" a rule rather than a slogan), its phases, its
 * desks, its listed catalogue, and its compliance and disclosure stance. The
 * Phase 1 coverage universe lives next door in `substrata-coverage.ts`. The
 * seed that registers the firm on-platform (scripts/seed-substrata.ts) reads
 * these two files and nothing else.
 *
 * On-platform shape: a `group` with label 'company' (public, so the research
 * and the book are both readable), its own `actors` row of actor_type 'group',
 * and a catalogue of `user_products` owned by that group actor. Ownership
 * follows the Revive My Old Ride convention — the founder's `mao` actor
 *
 * Created: 2026-08-26
 */
// =====================================================================
// IDENTITY
// =====================================================================

export const COMPANY = {
  name: 'Substrata',
  slug: 'substrata',
  tagline: 'The bottlenecks on the path to transformative technology, written down in public.',
} as const;

// =====================================================================
// OWNERSHIP
// =====================================================================

/** Actor slug of the user who founds the firm (created_by + founder seat). */
// =====================================================================
// THE MANDATE — first test: which curve does it move?
// =====================================================================

/**
 * Coverage and trading both start here. A node enters the universe only if it
 * sits on the critical path of one of three curves. Everything else — however
 * interesting, however profitable — is out of scope.
 */
export const MANDATE_CURVES = [
  {
    id: 'compute-per-joule',
    label: 'Compute per joule',
    test: 'Does this make a thought cheaper to have?',
    detail:
      'Feedstock, lithography consumables, thermal materials, and the firms ' +
      'that make them — what decides how much computation a watt can buy.',
  },
  {
    id: 'joules-delivered',
    label: 'Joules delivered',
    test: 'Does this get power to where the compute is?',
    detail:
      'Transformer steel, conductors, superconducting tape, the cryogens that ' +
      'keep them cold, and the interconnect queue. A datacentre that cannot ' +
      'be energised is a shed.',
  },
  {
    id: 'actuation',
    label: 'Actuation',
    test: 'Does this give intelligence hands?',
    detail:
      'Permanent-magnet feed, precision drives, additive manufacturing — the ' +
      'step where a model stops advising and starts doing physical work.',
  },
] as const;

export type CurveId = (typeof MANDATE_CURVES)[number]['id'];

// =====================================================================
// THE MANDATE — second test: is it actually a chokepoint?
// =====================================================================

/**
 * Being on a curve is not enough; most of a supply chain is substitutable and
 * therefore uninteresting. A node earns coverage when it GATES a curve. These
 * four factors are the screen, and they are why the universe stays countable
 * as the firm expands from materials into robotics, compute and manufacturing.
 */
export const CHOKEPOINT_TEST = [
  {
    id: 'concentration',
    question: 'How few suppliers actually qualify?',
    detail: 'Qualified is not the same as capable — a producer nobody has certified is not supply.',
  },
  {
    id: 'substitutability',
    question: 'What happens if it disappears — a workaround, or a stop?',
    detail: 'A material with a drop-in replacement is a price story, not a chokepoint.',
  },
  {
    id: 'lead-time',
    question: 'How long from order to delivery, and from decision to new capacity?',
    detail: 'Large power transformers gate more datacentres today than chip supply does.',
  },
  {
    id: 'demand-inelasticity',
    question: 'Can the buyer walk away at any price?',
    detail: 'If the machine does not exist without it, the demand curve is a wall.',
  },
] as const;

/**
 * The exclusion rule, stated plainly because it is the harder half of focus.
 * A firm that will cover anything has no edge, in the same way that an analyst
 * with an opinion on everything has none worth reading.
 */
export const EXCLUSION_RULE = {
  rule: 'On a curve, and a chokepoint. Fail either test and it does not enter coverage.',
  explainer:
    'We decline business and coverage every week. Not because either is ' +
    'unprofitable, but because a universe that drifts into general commodities ' +
    'and general tech loses the only edge a specialist has: knowing, for a ' +
    'countable number of nodes, every qualified producer, every grade that ' +
    'actually ships, and every lead time that is real rather than quoted.',
} as const;

// =====================================================================
// NODE TYPES — how the universe grows without becoming "everything"
// =====================================================================

/**
 * The unit of coverage is a chokepoint NODE, not an asset class. A node can be
 * a material, a company, a person, a machine or a process — the tests above
 * apply identically to all of them. This is what lets the firm move from rare
 * earths into robotics, AI hardware and additive manufacturing without a
 * change of strategy: you do not decide to cover robotics, you ARRIVE at it by
 * tracing dysprosium downstream. The graph grows by traversal, not by ambition.
 */
export const NODE_TYPES = [
  {
    id: 'material',
    label: 'Material',
    detail: 'A substance with a grade, a purity and a producer.',
  },
  {
    id: 'company',
    label: 'Company',
    detail: 'Public or private. Most of the interesting ones are private.',
  },
  { id: 'person', label: 'Person', detail: 'Where the process knowledge actually lives.' },
  {
    id: 'machine',
    label: 'Machine',
    detail: 'Tools with single-digit annual output and multi-year queues.',
  },
  {
    id: 'process',
    label: 'Process',
    detail: 'Know-how that does not transfer with a purchase order.',
  },
] as const;

export type NodeType = (typeof NODE_TYPES)[number]['id'];

// =====================================================================
// PHASES — research first, trade second, integrate third
// =====================================================================

/**
 * Research leads because it costs nothing but attention, because it IS the
 * sourcing work the desk needs anyway, and because publishing is the
 * distribution engine: put the map out, the people who work in it correct it,
 * and you become the place people check. The research is given away; what is
 * monetised is the position it buys — deal flow, counterparty access, and a
 * view of where the chain is thin.
 */
export const PHASES = [
  {
    id: 'producers-of-the-fifteen',
    label: 'Phase 1 — the producers of the fifteen',
    status: 'active',
    detail:
      'Map every qualified producer of the fifteen materials under coverage. ' +
      'Mostly private, mostly uncovered: the sell side writes about chip ' +
      'designers, not about who fires crucible-grade quartz.',
  },
  {
    id: 'beyond-materials',
    label: 'Phase 2 — the chokepoints that are not materials',
    status: 'active',
    detail:
      'A material is only one kind of chokepoint. A tool with one supplier, ' +
      'packaging capacity allocated years ahead, a transformer order book, an ' +
      'interconnection queue and a process that lives in people rather than ' +
      'equipment all gate the same curves. These enter coverage on the same ' +
      'two tests, and the universe has already started admitting them.',
  },
  {
    id: 'one-hop-out',
    label: 'Phase 3 — one hop out',
    status: 'planned',
    detail:
      'From each node, one hop upstream and one downstream. This is where ' +
      'robotics, AI hardware and additive manufacturing enter on their own — ' +
      'as counterparties in a chain already being mapped, not as a new vertical.',
  },
  {
    id: 'desk',
    label: 'Later — a desk, if and when it is licensed',
    status: 'not-started',
    detail:
      'Acting on the map rather than only publishing it means a regulated ' +
      'book: licensing, compliance, capital and counterparty onboarding, none ' +
      'of it quick. It is an intention, not a service, and nothing on this ' +
      'site should be read as an offer to trade.',
  },
] as const;

// =====================================================================
// COVERAGE AREAS
//
// Named for segments of the chain, not for trading desks — there is no desk.
// =====================================================================

export type AreaId = 'lithography' | 'feedstock' | 'thermal' | 'power' | 'actuation';

export interface CoverageArea {
  id: AreaId;
  name: string;
  curve: CurveId;
  covers: string;
}

export const COVERAGE_AREAS: readonly CoverageArea[] = [
  {
    id: 'lithography',
    name: 'Lithography & Optics',
    curve: 'compute-per-joule',
    covers:
      'Consumables the leading-edge fab burns to expose a wafer: EUV droplet ' +
      'tin, excimer and source gases, capping-layer platinum-group metals, ' +
      'fused silica and calcium fluoride optical blanks.',
  },
  {
    id: 'feedstock',
    name: 'Semiconductor Feedstock',
    curve: 'compute-per-joule',
    covers:
      'What a wafer is made of before anything is printed on it: ' +
      'electronic-grade polysilicon, prime wafers, crucible-grade quartz, and ' +
      'the compound-semiconductor metals — gallium, germanium, indium.',
  },
  {
    id: 'thermal',
    name: 'Thermal & Packaging',
    curve: 'compute-per-joule',
    covers:
      'The materials that carry heat away from a die, which is what actually ' +
      'caps rack density: CVD diamond and SiC spreaders, wide-bandgap ' +
      'substrates, two-phase dielectric coolants.',
  },
  {
    id: 'power',
    name: 'Power, Grid & Superconductors',
    curve: 'joules-delivered',
    covers:
      'Grain-oriented electrical steel for transformers, Grade A copper, ' +
      'REBCO superconducting tape, and the helium that keeps superconductors ' +
      'superconducting.',
  },
  {
    id: 'actuation',
    name: 'Actuation & Robotics',
    curve: 'actuation',
    covers:
      'Permanent-magnet feed — didymium and the heavy rare earths that hold ' +
      'coercivity hot — plus the cobalt and precision-drive alloys behind ' +
      'every robot joint.',
  },
] as const;

// =====================================================================
// MATERIALS UNDER COVERAGE
//
// Research subjects, not a price list. There are deliberately no prices, no
// units and no lot sizes here: this firm does not trade, and a page carrying
// indicative levels reads as an invitation to deal whatever the small print
// says. What is kept is the part that is research — why the material gates a
// curve, and which grade actually ships, since "tin" and "seven-nines tin
// qualified for an EUV source" are different markets.
//
// This list is also the Phase 1 work queue: `substrata-coverage.ts` owes a
// producer map to every title here, and a test enforces the correspondence.
// =====================================================================

export interface MaterialListing {
  /** Display name, and the key `substrata-coverage.ts` maps producers onto. */
  title: string;
  area: AreaId;
  /** Why this material gates a curve — the research claim. */
  why: string;
  /** The grade that actually ships. Naming it is most of the specialism. */
  spec: string;
  /** What the trade calls it — the term the research engine searches a producer against. */
  search: string;
  tags: string[];
}

export const MATERIALS: readonly MaterialListing[] = [
  // ---------- Lithography & Optics ----------
  {
    title: 'High-purity tin, EUV droplet grade',
    area: 'lithography',
    why: 'Every EUV photon in production today starts as a tin droplet hit by a CO₂ laser. Purity, not tonnage, is the constraint.',
    spec: '7N (99.99999%) tin, shot or ingot, certificate of analysis per lot.',
    search: 'tin',
    tags: ['euv', 'lithography', 'tin', 'high-purity'],
  },
  {
    title: 'Neon, excimer laser grade',
    area: 'lithography',
    why: 'DUV excimer sources run on neon mixtures. The 2022 squeeze showed how thin and how geographically concentrated that supply is.',
    spec: '≥99.999% neon, cylinder or ISO container, blended mixes to order.',
    search: 'neon',
    tags: ['neon', 'noble-gas', 'duv', 'lithography'],
  },
  {
    title: 'Ruthenium, sputtering and ALD grade',
    area: 'lithography',
    why: 'Caps EUV multilayer mirrors and lines advanced interconnect. Annual world supply is a few dozen tonnes, almost all a by-product of other mining.',
    spec: '4N ruthenium, targets or precursor feed, PGM-refiner traceable.',
    search: 'ruthenium',
    tags: ['ruthenium', 'pgm', 'euv', 'interconnect'],
  },

  // ---------- Semiconductor Feedstock ----------
  {
    title: 'Electronic-grade polysilicon',
    area: 'feedstock',
    why: 'The first material in the chain. Solar-grade will not do: one part per billion of boron changes the device.',
    spec: '11N (99.999999999%) polysilicon chunk or rod, Siemens process.',
    search: 'polysilicon',
    tags: ['polysilicon', 'feedstock', 'wafer', 'high-purity'],
  },
  {
    title: '300 mm prime silicon wafers',
    area: 'feedstock',
    why: 'The unit of account for all leading-edge capacity. Every fab expansion is ultimately a wafer-start number.',
    spec: 'Prime polished 300 mm, p-type or n-type, epi to specification.',
    search: 'silicon wafer',
    tags: ['wafer', '300mm', 'silicon', 'feedstock'],
  },
  {
    title: 'Crucible-grade high-purity quartz sand',
    area: 'feedstock',
    why: 'Czochralski crucibles need a quartz purity that comes, in practice, from a very small number of deposits. A genuine single point of failure for the whole industry.',
    spec: 'Inner-layer crucible grade, ≤ 20 ppm total impurities.',
    search: 'quartz',
    tags: ['quartz', 'crucible', 'czochralski', 'feedstock'],
  },
  {
    title: 'Gallium, refined',
    area: 'feedstock',
    why: 'GaN power stages and RF front-ends. A by-product of alumina refining, so supply cannot respond quickly to demand — and it is export-controlled.',
    spec: '4N–7N gallium metal. Export-licence and end-use documentation required.',
    search: 'gallium',
    tags: ['gallium', 'gan', 'compound-semiconductor', 'export-controlled'],
  },

  // ---------- Thermal & Packaging ----------
  {
    title: 'CVD synthetic diamond heat spreader',
    area: 'thermal',
    why: 'The highest thermal conductivity available at any price. Where the die is hot enough that copper has stopped being an answer.',
    spec: 'Polycrystalline CVD diamond, 10 × 10 mm, metallised to specification.',
    search: 'CVD diamond',
    tags: ['diamond', 'thermal', 'packaging', 'cvd'],
  },
  {
    title: 'Silicon carbide substrate, 200 mm semi-insulating',
    area: 'thermal',
    why: 'Wide-bandgap power conversion is how a datacentre stops wasting a tenth of its intake as heat in the power train.',
    spec: '200 mm semi-insulating 4H-SiC, micropipe density to specification.',
    search: 'silicon carbide',
    tags: ['sic', 'wide-bandgap', 'power', 'substrate'],
  },
  {
    title: 'Two-phase dielectric immersion coolant',
    area: 'thermal',
    why: 'Air cooling ends somewhere around 50 kW a rack. Immersion is what the next order of magnitude of density runs on.',
    spec: 'Engineered fluid, boiling point matched to the target die temperature.',
    search: 'immersion cooling',
    tags: ['immersion', 'cooling', 'datacenter', 'dielectric'],
  },

  // ---------- Power, Grid & Superconductors ----------
  {
    title: 'Grain-oriented electrical steel (GOES)',
    area: 'power',
    why: 'Every megawatt reaching a GPU passes through transformer cores. Lead times on large power transformers, not chip supply, are the binding constraint on many buildouts.',
    spec: 'M3-class grain-oriented silicon steel, coil, coated.',
    search: 'electrical steel',
    tags: ['goes', 'transformer', 'grid', 'electrical-steel'],
  },
  {
    title: 'REBCO superconducting tape, 12 mm',
    area: 'power',
    why: 'High-field magnets for fusion and for compact motors. The kilometre-per-machine numbers make tape output an industry-level bottleneck.',
    spec: '12 mm REBCO tape, critical current specified at 77 K, self-field.',
    search: 'REBCO',
    tags: ['rebco', 'superconductor', 'fusion', 'magnets'],
  },
  {
    title: 'Liquid helium (He-4)',
    area: 'power',
    why: 'Nothing else reaches 4 K at scale. Superconducting magnets and every dilution refrigerator in quantum computing depend on a supply tied to a handful of gas fields.',
    spec: '5N liquid helium, dewar or ISO container, boil-off terms per contract.',
    search: 'helium',
    tags: ['helium', 'cryogenics', 'superconductor', 'quantum'],
  },

  // ---------- Actuation & Robotics ----------
  {
    title: 'Didymium (Nd-Pr) metal, magnet feed',
    area: 'actuation',
    why: 'The bulk of every NdFeB magnet, and therefore of every robot joint, traction motor and hard-drive actuator.',
    spec: 'Nd-Pr metal ingot, 75/25 nominal, ≥99% RE.',
    search: 'rare earth',
    tags: ['rare-earth', 'ndfeb', 'magnets', 'robotics'],
  },
  {
    title: 'Dysprosium metal',
    area: 'actuation',
    why: 'The heavy rare earth that keeps a magnet coercive when the motor gets hot. Small quantities, no substitute, single-country refining.',
    spec: '≥99% dysprosium metal. Export-licence and end-use documentation required.',
    search: 'dysprosium',
    tags: ['dysprosium', 'rare-earth', 'magnets', 'export-controlled'],
  },
];

// =====================================================================
// SCOPE — what this firm does not do
// =====================================================================

/**
 * Several materials under coverage are dual-use and export-controlled
 * (gallium, germanium, the heavy rare earths). That is a fact ABOUT them and a
 * reason to cover them carefully — it is not an operating obligation here,
 * because nothing is bought, sold, brokered or moved. Saying so plainly
 * matters more than a compliance section would: an export-licence policy on a
 * firm with no shipments is theatre, and theatre is what makes the honest
 * parts of a page harder to believe.
 */
export const SCOPE = {
  today: [
    'We publish research. We do not trade, broker, quote, or arrange the ' +
      'movement of any material under coverage.',
    'Nothing on this site is an offer, a solicitation, an inducement to deal, ' +
      'or investment advice.',
    'We hold no position in anything we cover. When that changes it will be ' +
      'disclosed before the note, not after.',
  ],
  outOfScope:
    'Nothing on the weapons or nuclear-fuel-cycle path is covered, and no ' +
    'coverage is written to help anyone acquire a controlled material. The ' +
    'three curves are compute, energy and actuation.',
} as const;

// =====================================================================
// DISCLOSURE — written before there is anything to disclose
// =====================================================================

/**
 * Today the disclosure is short, because the firm holds nothing: no book, no
 * positions, no counterparties. The rules below are kept anyway, in advance of
 * the desk that may one day exist, for the reason a disclosure policy is only
 * ever credible before it is needed. Written after the first position, every
 * clause reads as a response to something.
 */
export const DISCLOSURE = {
  today:
    'Substrata holds no position in anything it covers, trades nothing, and ' +
    'is paid by nobody it writes about. There is currently nothing to declare, ' +
    'and that itself is the declaration.',
  rules: [
    'Every published note states the firm’s position in what it covers — long, ' +
      'short, flat, or none — at time of publication.',
    'Research is never withheld, delayed or softened because of a position. If ' +
      'the two conflict, the position is the thing that moves.',
    'Nothing is published to move a price the firm is about to act on. Notes go ' +
      'out on a schedule.',
    'Sources are named. An unsourced claim is marked unverified rather than ' +
      'stated, however confident the analyst is.',
  ],
  openByDefault:
    'The research is free and public. What it buys is standing — being the ' +
    'place people check, and being told when a row is wrong by someone who ' +
    'works in that chain.',
} as const;

// =====================================================================
// PUBLIC LISTING COPY
// =====================================================================

export const LISTING_COPY = {
  headline: COMPANY.name,
  subhead: COMPANY.tagline,
  body: [
    'Substrata is an open-source research firm covering the physical ' +
      'bottlenecks on the path to transformative technology. The research ' +
      'is free and the map is the product. There is no trading desk and no ' +
      'position in anything covered here.',
    'A node enters coverage only if it passes two tests: it moves one of ' +
      'three curves — compute per joule, joules delivered, or actuation — and ' +
      'it genuinely gates that curve, on concentration, substitutability, ' +
      'lead time and demand inelasticity. A node can be a material, a machine, ' +
      'a company, a process or a person; the tests do not care, and a tool ' +
      'with one supplier gates a curve as hard as an element does.',
    'Two phases run at once. Every qualified producer of the fifteen ' +
      'materials under coverage, and the chokepoints that are not materials ' +
      'at all — packaging capacity, transformer order books, interconnection ' +
      'queues, process knowledge that does not transfer with equipment.',
  ],
  cta: 'Read the map',
} as const;

// =====================================================================
// GROUP PROFILE PAYLOAD (maps 1:1 to the live `groups` table)
// =====================================================================

export // =====================================================================
// LOOKUPS
// =====================================================================

const AREA_BY_ID: Record<AreaId, CoverageArea> = COVERAGE_AREAS.reduce(
  (acc, area) => ({ ...acc, [area.id]: area }),
  {} as Record<AreaId, CoverageArea>,
);

/** @returns the coverage area a material belongs to. */
export function areaFor(material: MaterialListing): CoverageArea {
  return AREA_BY_ID[material.area];
}
