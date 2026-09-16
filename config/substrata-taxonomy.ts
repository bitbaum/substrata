/**
 * How a reader finds a bottleneck: in plain English, by technology, and by
 * industry.
 *
 * The assessment file says how hard a row binds. This one says what it is in
 * words a non-specialist can hold, which front of technology it bears on, and
 * which industry a reader would go looking under. Those are different
 * questions from severity, so they live apart — and a test insists every
 * bottleneck appears here exactly once with at least one technology and one
 * industry, so the two files cannot drift.
 *
 * "Technology" here means a front of progress, not a product. "Industry"
 * means the trade a reader would search for.
 *
 * Created: 2026-09-15
 */

export type TechnologyId = 'ai' | 'robotics' | 'energy' | 'manufacturing' | 'space';
export type IndustryId =
  | 'semiconductors'
  | 'power-grid'
  | 'mining-materials'
  | 'gases-chemicals'
  | 'data-centres'
  | 'machinery';

export interface Technology {
  id: TechnologyId;
  name: string;
  /** One sentence: what this front is trying to do. */
  detail: string;
}

export interface Industry {
  id: IndustryId;
  name: string;
  detail: string;
}

export const TECHNOLOGIES: readonly Technology[] = [
  {
    id: 'ai',
    name: 'AI & compute',
    detail: 'Training and running models: the chips, memory and packaging they need.',
  },
  {
    id: 'robotics',
    name: 'Robotics & autonomy',
    detail: 'Machines that act in the world: motors, drives, sensors and the magnets inside them.',
  },
  {
    id: 'energy',
    name: 'Energy',
    detail: 'Generating power and getting it to where the work happens.',
  },
  {
    id: 'manufacturing',
    name: 'Advanced manufacturing',
    detail: 'Making physical things faster: fabs, additive manufacturing, precision assembly.',
  },
  {
    id: 'space',
    name: 'Space & launch',
    detail:
      'Getting mass to orbit and building there. Shares magnets, alloys and electronics with the rest.',
  },
];

export const INDUSTRIES: readonly Industry[] = [
  {
    id: 'semiconductors',
    name: 'Semiconductors',
    detail: 'Chips, the tools that make them and the chemicals they consume.',
  },
  {
    id: 'power-grid',
    name: 'Power & grid',
    detail: 'Generation, transmission equipment and the queue to connect to it.',
  },
  {
    id: 'mining-materials',
    name: 'Mining & materials',
    detail: 'Extraction, refining and the qualified grades that ship.',
  },
  {
    id: 'gases-chemicals',
    name: 'Gases & chemicals',
    detail: 'Industrial gases, resists, coolants and the plants that separate them.',
  },
  {
    id: 'data-centres',
    name: 'Data centres',
    detail: 'The buildings, cooling and power that house compute.',
  },
  {
    id: 'machinery',
    name: 'Machinery & components',
    detail: 'Drives, encoders, magnets, turbines and the firms that build them.',
  },
];

export interface Classification {
  /** What it is, for someone who has never heard of it. No acronyms, no grades. */
  plain: string;
  technologies: TechnologyId[];
  industries: IndustryId[];
}

/** Keyed by the exact bottleneck name: a material title or a chokepoint name. */
export const CLASSIFICATION: Record<string, Classification> = {
  // ---------- Materials ----------
  'High-purity tin, EUV droplet grade': {
    plain:
      'Ultra-pure tin droplets, vaporised by a laser to make the light that prints the most advanced chips.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors', 'mining-materials'],
  },
  'Neon, excimer laser grade': {
    plain:
      'A rare gas that fills the lasers in chipmaking machines. Separated from air, mostly as a by-product of making steel.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors', 'gases-chemicals'],
  },
  'Ruthenium, sputtering and ALD grade': {
    plain:
      'A rare metal being adopted for the wiring inside advanced chips. It comes out of the ground only alongside platinum.',
    technologies: ['ai'],
    industries: ['semiconductors', 'mining-materials'],
  },
  'Electronic-grade polysilicon': {
    plain: 'Silicon purified to eleven nines, the raw material every silicon wafer starts from.',
    technologies: ['ai', 'energy'],
    industries: ['semiconductors', 'mining-materials'],
  },
  '300 mm prime silicon wafers': {
    plain:
      'The polished silicon discs every chip is built on. Five companies make them for the whole world.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors'],
  },
  'Crucible-grade high-purity quartz sand': {
    plain:
      'An unusually pure sand used to line the crucibles that grow silicon crystals. Most of it comes from one place on earth.',
    technologies: ['ai', 'energy'],
    industries: ['semiconductors', 'mining-materials'],
  },
  'Gallium, refined': {
    plain:
      'A soft metal recovered from aluminium refining, used in fast power and radio chips. China refines almost all of it and licenses its export.',
    technologies: ['ai', 'energy', 'space'],
    industries: ['semiconductors', 'mining-materials'],
  },
  'CVD synthetic diamond heat spreader': {
    plain:
      'Laboratory-grown diamond used to pull heat out of the hottest chips. Nothing conducts heat better.',
    technologies: ['ai'],
    industries: ['semiconductors', 'data-centres'],
  },
  'Silicon carbide substrate, 200 mm semi-insulating': {
    plain:
      'A harder-than-silicon crystal used where power and heat are high, such as chargers, motors and radar.',
    technologies: ['energy', 'robotics', 'space'],
    industries: ['semiconductors', 'machinery'],
  },
  'Two-phase dielectric immersion coolant': {
    plain:
      'An engineered liquid that servers are submerged in, which boils to carry heat away. The main maker has left the business.',
    technologies: ['ai'],
    industries: ['data-centres', 'gases-chemicals'],
  },
  'Grain-oriented electrical steel (GOES)': {
    plain:
      'The specially grown steel inside a large power transformer. Few mills can make it, and a new mill takes years.',
    technologies: ['energy'],
    industries: ['power-grid', 'mining-materials'],
  },
  'REBCO superconducting tape, 12 mm': {
    plain:
      'A ceramic tape that carries current with no resistance when cold. It is the wire in modern fusion magnets.',
    technologies: ['energy', 'space'],
    industries: ['power-grid', 'machinery'],
  },
  'Liquid helium (He-4)': {
    plain:
      'The only practical way to reach the temperatures superconducting magnets and some chip tools need. It cannot be manufactured.',
    technologies: ['energy', 'ai'],
    industries: ['gases-chemicals', 'semiconductors'],
  },
  'Didymium (Nd-Pr) metal, magnet feed': {
    plain:
      'The rare-earth metal blend that makes strong permanent magnets, and therefore most electric motors.',
    technologies: ['robotics', 'energy', 'space'],
    industries: ['mining-materials', 'machinery'],
  },
  'Dysprosium metal': {
    plain:
      'A rare earth added to magnets so they keep their strength when hot. Almost entirely Chinese, and export-controlled.',
    technologies: ['robotics', 'energy'],
    industries: ['mining-materials', 'machinery'],
  },

  // ---------- Machines, processes, companies, people ----------
  'EUV lithography scanners': {
    plain: 'The machines that print the finest circuit patterns. One company on earth builds them.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors'],
  },
  'EUV projection optics': {
    plain:
      'The mirrors inside those machines, polished flatter than anything else made. One supplier has ever achieved it.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors'],
  },
  'Advanced packaging capacity': {
    plain:
      'Assembling several chips into one AI accelerator. How many exist is set here, not at the wafer.',
    technologies: ['ai'],
    industries: ['semiconductors'],
  },
  'High-bandwidth memory stacking yield': {
    plain:
      'Stacking memory chips next to a processor without breaking them. Three companies can do it at volume.',
    technologies: ['ai'],
    industries: ['semiconductors'],
  },
  'Leading-edge foundry capacity': {
    plain:
      'Factories that can make chips at the newest generation. A handful exist and a new one takes years and billions.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors'],
  },
  'Photoresist formulation': {
    plain:
      'The light-sensitive chemistry that turns a projected pattern into a circuit. Overwhelmingly Japanese, and qualified factory by factory.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors', 'gases-chemicals'],
  },
  'Large power transformer slots': {
    plain:
      'The big transformers a data centre needs to take grid power. Ordering one now means waiting years.',
    technologies: ['energy', 'ai'],
    industries: ['power-grid', 'data-centres'],
  },
  'Grid interconnection queues': {
    plain:
      'The administrative line to be connected to the electricity grid. In several markets it is the slowest step in building anything.',
    technologies: ['energy', 'ai'],
    industries: ['power-grid', 'data-centres'],
  },
  'Heavy-duty gas turbine order books': {
    plain:
      'The fastest way to add firm power at scale. The three makers are sold out into the next decade.',
    technologies: ['energy'],
    industries: ['power-grid', 'machinery'],
  },
  'High-voltage cable and switchgear': {
    plain:
      'The cables and switches that move power at high voltage. Same multi-year queues as transformers.',
    technologies: ['energy'],
    industries: ['power-grid', 'machinery'],
  },
  'Rare-earth magnet sintering': {
    plain:
      'Turning rare-earth powder into a finished magnet. Even where the metal is mined elsewhere, this step is Chinese.',
    technologies: ['robotics', 'energy'],
    industries: ['machinery', 'mining-materials'],
  },
  'Precision reduction drives': {
    plain:
      'The gearboxes that let a robot joint move precisely and hold a load. A few Japanese firms set what is possible.',
    technologies: ['robotics', 'manufacturing'],
    industries: ['machinery'],
  },
  'Robot-grade encoders and force sensors': {
    plain: 'The senses of a robot: what tells it where its joint is and how hard it is pushing.',
    technologies: ['robotics'],
    industries: ['machinery'],
  },
  'Semiconductor process engineers': {
    plain:
      'People who have brought a chip factory into production before. You cannot buy them and you cannot hurry them.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors'],
  },
  'Battery-grade lithium chemicals': {
    plain:
      'Lithium turned into the hydroxide or carbonate a battery plant will actually accept. A salt lake is not a chemical.',
    technologies: ['energy', 'robotics'],
    industries: ['mining-materials', 'gases-chemicals'],
  },
  'Uranium conversion and enrichment': {
    plain:
      'Turning mined uranium into the fuel a reactor can burn. Few states do this, and they do not do it quickly.',
    technologies: ['energy'],
    industries: ['power-grid', 'mining-materials'],
  },
  'Laser powder-bed fusion machines': {
    plain:
      'Printers that melt metal powder with a laser, layer by layer, into a qualified part. The brochure is not the qualification.',
    technologies: ['manufacturing', 'space', 'robotics'],
    industries: ['machinery', 'semiconductors'],
  },
  'SMR first-of-a-kind licensing': {
    plain:
      'Permission to build the first small nuclear reactor of a new design. The physics is known; the licence is the wait.',
    technologies: ['energy'],
    industries: ['power-grid'],
  },
};

const TECH_BY_ID = new Map(TECHNOLOGIES.map((t) => [t.id, t]));
const INDUSTRY_BY_ID = new Map(INDUSTRIES.map((i) => [i.id, i]));

export const TECHNOLOGY_LABEL: Record<TechnologyId, string> = Object.fromEntries(
  TECHNOLOGIES.map((t) => [t.id, t.name]),
) as Record<TechnologyId, string>;

export const INDUSTRY_LABEL: Record<IndustryId, string> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.id, i.name]),
) as Record<IndustryId, string>;

export function technologyById(id: TechnologyId): Technology {
  const found = TECH_BY_ID.get(id);
  if (!found) throw new Error(`Unknown technology: ${id}`);
  return found;
}

export function industryById(id: IndustryId): Industry {
  const found = INDUSTRY_BY_ID.get(id);
  if (!found) throw new Error(`Unknown industry: ${id}`);
  return found;
}

/** The classification for a bottleneck. Missing one is a build error, not a blank. */
export function classificationFor(name: string): Classification {
  const found = CLASSIFICATION[name];
  if (!found) {
    throw new Error(`No classification for "${name}" in config/substrata-taxonomy.ts`);
  }
  return found;
}
