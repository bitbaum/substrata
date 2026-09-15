/**
 * Science: what would remove a bottleneck, and how far off it is.
 *
 * A map of constraints is only half useful. The other half is what could
 * relieve each one — a different material, a different process, a different
 * machine — and how close that is to being usable at scale.
 *
 * Readiness here is a JUDGEMENT on a nine-point scale, written by hand, with
 * the reasoning next to it. It is not a measurement and it is not a vendor's
 * claim. Where no source has been attached to a row, the page says the row is
 * unsourced rather than implying otherwise; attaching sources to these is the
 * next research pass.
 *
 * Every entry names the bottleneck it would relieve and the mechanism by
 * which it would. A test refuses an entry naming a bottleneck that is not in
 * the coverage universe, so this file cannot quietly invent a constraint.
 *
 * Created: 2026-09-15
 */

import type { IndustryId, TechnologyId } from './substrata-taxonomy';

/** The nine-point scale, stated on the page so a reader can argue with a number. */
export const READINESS_SCALE: readonly { level: number; label: string }[] = [
  { level: 1, label: 'Idea with a physical basis' },
  { level: 2, label: 'Concept worked out on paper' },
  { level: 3, label: 'Demonstrated in a laboratory' },
  { level: 4, label: 'Works as a component in a lab' },
  { level: 5, label: 'Works in a realistic setting' },
  { level: 6, label: 'Prototype at meaningful scale' },
  { level: 7, label: 'Pilot running in the real environment' },
  { level: 8, label: 'Qualified and entering production' },
  { level: 9, label: 'In production at scale' },
];

export interface Relief {
  /** Exact bottleneck name from the coverage universe. */
  bottleneck: string;
  /** How this would relieve it, in one line. */
  mechanism: string;
}

export interface ScienceEntry {
  id: string;
  name: string;
  front: TechnologyId;
  industries: IndustryId[];
  /** What it is, for someone who has never heard of it. */
  plain: string;
  relieves: Relief[];
  /** 1–9 on the scale above. A judgement. */
  readiness: number;
  /** Why that number, in one line. */
  readinessWhy: string;
  /** A source for the readiness claim, or null — in which case the page says unsourced. */
  source: string | null;
  /** What to watch for next. Null where nothing specific is known. */
  nextMilestone: string | null;
  judgedOn: string;
}

const ON = '2026-09-15';

export const SCIENCE: readonly ScienceEntry[] = [
  {
    id: 'hts-fusion-magnets',
    name: 'High-temperature superconducting magnets',
    front: 'energy',
    industries: ['power-grid', 'machinery'],
    plain:
      'Magnets wound from ceramic tape that carries current without resistance, strong enough to hold a fusion plasma in a machine small enough to build quickly.',
    relieves: [
      {
        bottleneck: 'REBCO superconducting tape, 12 mm',
        mechanism:
          'It does not relieve this bottleneck — it is the reason for it. Every fusion programme buying tape competes for the same few production lines.',
      },
    ],
    readiness: 6,
    readinessWhy:
      'Full-scale magnets have been built and tested; no power plant has run on them. The constraint has moved from physics to tape supply.',
    source: null,
    nextMilestone:
      'A machine sustaining more fusion power out than heating power in, using these magnets.',
    judgedOn: ON,
  },
  {
    id: 'small-modular-reactors',
    name: 'Small modular reactors',
    front: 'energy',
    industries: ['power-grid', 'data-centres'],
    plain:
      'Nuclear reactors small enough to build in a factory and truck to site, rather than constructing each one in place.',
    relieves: [
      {
        bottleneck: 'Heavy-duty gas turbine order books',
        mechanism:
          'An alternative source of firm, always-on power that does not queue for a turbine slot.',
      },
      {
        bottleneck: 'Grid interconnection queues',
        mechanism:
          'Sited next to the load, it can skip the transmission queue that a distant plant cannot.',
      },
    ],
    readiness: 6,
    readinessWhy:
      'Designs are licensed or in licensing and first units are under construction; none is yet delivering power at scale in a Western market.',
    source: null,
    nextMilestone: 'A commercial unit delivering power to a datacentre-scale load.',
    judgedOn: ON,
  },
  {
    id: 'high-na-euv',
    name: 'High-numerical-aperture EUV',
    front: 'ai',
    industries: ['semiconductors'],
    plain:
      'The next generation of the machine that prints chip patterns, with larger optics that resolve finer features in one pass.',
    relieves: [
      {
        bottleneck: 'Leading-edge foundry capacity',
        mechanism:
          'Printing finer features in a single exposure removes multi-pass steps, so each machine produces more finished wafers.',
      },
    ],
    readiness: 7,
    readinessWhy:
      'Systems have been delivered to chipmakers and are in use for development work, not yet in volume production.',
    source: null,
    nextMilestone: 'A product shipping in volume from a high-NA layer.',
    judgedOn: ON,
  },
  {
    id: 'dry-resist',
    name: 'Dry and metal-oxide photoresists',
    front: 'ai',
    industries: ['semiconductors', 'gases-chemicals'],
    plain:
      'A different chemistry for the light-sensitive layer on a wafer, deposited as a film rather than spun on as a liquid.',
    relieves: [
      {
        bottleneck: 'Photoresist formulation',
        mechanism:
          'A second chemical route to the same step, from a different and less concentrated supply base.',
      },
    ],
    readiness: 6,
    readinessWhy:
      'Demonstrated on production-class tools and being qualified; qualification is per process and per factory, which is the slow part.',
    source: null,
    nextMilestone: 'A leading-edge node qualifying it for a production layer.',
    judgedOn: ON,
  },
  {
    id: 'hybrid-bonding',
    name: 'Hybrid bonding',
    front: 'ai',
    industries: ['semiconductors'],
    plain:
      'Joining two chips copper-to-copper with no bumps between them, so they behave more like one piece of silicon.',
    relieves: [
      {
        bottleneck: 'High-bandwidth memory stacking yield',
        mechanism:
          'Removes the bump layer that limits how many memory dies can be stacked and cooled.',
      },
      {
        bottleneck: 'Advanced packaging capacity',
        mechanism:
          'More function per package reduces how much packaging capacity a given amount of compute needs.',
      },
    ],
    readiness: 7,
    readinessWhy:
      'In production for some image sensors and logic stacks; ramping for memory stacks.',
    source: null,
    nextMilestone: 'A memory generation shipping in volume on hybrid bonding.',
    judgedOn: ON,
  },
  {
    id: 'gan-power',
    name: 'Gallium nitride power conversion',
    front: 'energy',
    industries: ['semiconductors', 'data-centres'],
    plain:
      'Power electronics built on gallium nitride rather than silicon, which waste less energy as heat when converting voltage.',
    relieves: [
      {
        bottleneck: 'Large power transformer slots',
        mechanism:
          'Solid-state conversion at the rack and building level reduces, though does not remove, what the grid-facing transformer must do.',
      },
    ],
    readiness: 8,
    readinessWhy:
      'In volume production for consumer and datacentre power; higher-voltage grid use is earlier.',
    source: null,
    nextMilestone: 'Deployment at medium voltage in datacentre distribution.',
    judgedOn: ON,
  },
  {
    id: 'sic-200mm',
    name: '200 mm silicon carbide wafers',
    front: 'energy',
    industries: ['semiconductors', 'machinery'],
    plain:
      'Making silicon carbide crystals in bigger discs, so each one yields far more usable chips.',
    relieves: [
      {
        bottleneck: 'Silicon carbide substrate, 200 mm semi-insulating',
        mechanism: 'The larger wafer is the capacity increase: more die per boule at similar cost.',
      },
    ],
    readiness: 8,
    readinessWhy:
      'In production at several makers and expanding; the market is currently oversupplied rather than short.',
    source: null,
    nextMilestone: 'Whether 300 mm follows, and whether demand returns to absorb the capacity.',
    judgedOn: ON,
  },
  {
    id: 'hts-transmission',
    name: 'Superconducting transmission cable',
    front: 'energy',
    industries: ['power-grid'],
    plain:
      'Power cables cooled so they lose nothing in transit, carrying far more current through a much smaller duct.',
    relieves: [
      {
        bottleneck: 'High-voltage cable and switchgear',
        mechanism:
          'Moves more power through existing rights of way, avoiding some new conventional cable entirely.',
      },
    ],
    readiness: 6,
    readinessWhy:
      'City-scale links have run for years as demonstrations; no routine procurement path exists.',
    source: null,
    nextMilestone: 'A utility buying one as ordinary infrastructure rather than as a pilot.',
    judgedOn: ON,
  },
  {
    id: 'rare-earth-lean-motors',
    name: 'Rare-earth-lean and rare-earth-free motors',
    front: 'robotics',
    industries: ['machinery'],
    plain:
      'Motor designs that use less heavy rare earth, or none: ferrite magnets, wound rotors, and diffusion methods that place dysprosium only where it is needed.',
    relieves: [
      {
        bottleneck: 'Dysprosium metal',
        mechanism:
          'Cuts how much of the controlled element each motor needs, in some designs to zero.',
      },
      {
        bottleneck: 'Didymium (Nd-Pr) metal, magnet feed',
        mechanism:
          'Ferrite and wound-rotor designs avoid the rare-earth magnet entirely at a cost in size and weight.',
      },
    ],
    readiness: 8,
    readinessWhy:
      'Grain-boundary diffusion is standard practice and rare-earth-free traction motors are in production; the trade-off is mass and efficiency, not feasibility.',
    source: null,
    nextMilestone: 'Whether humanoid and robotics programmes adopt them, where mass matters most.',
    judgedOn: ON,
  },
  {
    id: 'neon-recycling',
    name: 'On-site neon recycling and separation',
    front: 'manufacturing',
    industries: ['gases-chemicals', 'semiconductors'],
    plain:
      'Capturing and re-purifying the rare gas a chip factory uses, instead of buying it fresh from an air separation plant.',
    relieves: [
      {
        bottleneck: 'Neon, excimer laser grade',
        mechanism: 'Cuts demand per factory and decouples supply from one region’s steel industry.',
      },
    ],
    readiness: 8,
    readinessWhy:
      'Adopted after the 2022 shortage and demonstrably effective; coverage across the industry is uneven.',
    source: null,
    nextMilestone:
      'Whether recycling holds through the next demand step, or the 2022 squeeze repeats.',
    judgedOn: ON,
  },
  {
    id: 'synthetic-crucible-quartz',
    name: 'Synthetic high-purity quartz for crucibles',
    front: 'manufacturing',
    industries: ['semiconductors', 'mining-materials'],
    plain:
      'Manufacturing the ultra-pure quartz that lines a crystal-growing crucible, rather than mining it from one deposit.',
    relieves: [
      {
        bottleneck: 'Crucible-grade high-purity quartz sand',
        mechanism:
          'Replaces a geological concentration with a factory, which can be built anywhere and expanded on demand.',
      },
    ],
    readiness: 5,
    readinessWhy:
      'Synthetic quartz is routine for other uses; matching the inner-layer crucible grade at acceptable cost is the open question.',
    source: null,
    nextMilestone: 'A crystal grower qualifying a synthetic inner layer in production.',
    judgedOn: ON,
  },
  {
    id: 'diamond-thermal',
    name: 'Diamond heat spreaders in production packaging',
    front: 'ai',
    industries: ['semiconductors', 'data-centres'],
    plain:
      'Putting a layer of laboratory-grown diamond next to the hottest part of a chip, because nothing else moves heat as fast.',
    relieves: [
      {
        bottleneck: 'CVD synthetic diamond heat spreader',
        mechanism:
          'Wider adoption is what would make this a bottleneck; today the constraint is cost, not supply.',
      },
      {
        bottleneck: 'Two-phase dielectric immersion coolant',
        mechanism: 'Better conduction at the die reduces how much the cooling fluid has to do.',
      },
    ],
    readiness: 5,
    readinessWhy:
      'Used in specialist radio-frequency and laser parts; not standard in high-volume logic packaging.',
    source: null,
    nextMilestone: 'A mainstream accelerator package adopting a diamond layer.',
    judgedOn: ON,
  },
];

export function scienceFor(bottleneck: string): ScienceEntry[] {
  return SCIENCE.filter((entry) => entry.relieves.some((r) => r.bottleneck === bottleneck));
}

export function readinessLabel(level: number): string {
  return READINESS_SCALE.find((s) => s.level === level)?.label ?? 'Unrated';
}

/** Three bands, for filtering without pretending the scale is precise. */
export type ReadinessBand = 'lab' | 'proving' | 'production';

export function readinessBand(level: number): ReadinessBand {
  if (level <= 4) return 'lab';
  if (level <= 7) return 'proving';
  return 'production';
}

export const READINESS_BAND_LABEL: Record<ReadinessBand, string> = {
  lab: 'In the lab',
  proving: 'Being proven',
  production: 'Reaching production',
};
