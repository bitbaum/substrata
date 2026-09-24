/**
 * The science pipeline: how far along the work that could relieve each
 * bottleneck is, and what evidence says so.
 *
 * Five stages, each mapped to a band of the nine-point readiness scale in
 * `substrata-science.ts`. A stage is ESTABLISHED for a row only when a piece of
 * evidence of the kind the stage names is attached — a paper, a grant, a
 * patent, a pilot announcement, a product launch, a filing. A stage with only
 * a judgement behind it and no citation is shown as CLAIMED.
 *
 * Two kinds of row reach a stage, and the page never blends them:
 *  - a JUDGEMENT written by hand (a science entry's readiness, a substitute's
 *    status), which stays labelled as a judgement with its reasoning;
 *  - an ITEM collected by the feeds (OpenAlex, arXiv, NSF, OpenAIRE, USAspending),
 *    placed on a stage by the rule in `lib/science-stage.ts` and labelled
 *    unreviewed. The rule never places an item beyond "pilot": a paper or a
 *    grant cannot show that something is on sale.
 *
 * Created: 2026-09-24
 */

export const PIPELINE_STAGES = [
  {
    id: 'fundamental',
    label: 'Fundamental research',
    short: 'Research',
    trl: [1, 2],
    evidence: 'A paper or preprint on the underlying physics or chemistry; a basic-research grant.',
  },
  {
    id: 'applied',
    label: 'Applied / lab',
    short: 'Lab',
    trl: [3, 4],
    evidence:
      'A paper reporting a device, process or material made and measured in a laboratory; an applied or SBIR Phase I grant; a patent.',
  },
  {
    id: 'pilot',
    label: 'Pilot / demonstration',
    short: 'Pilot',
    trl: [5, 7],
    evidence:
      'A pilot line, field trial or demonstration announced by the organisation running it; a demonstration or SBIR Phase II grant.',
  },
  {
    id: 'early',
    label: 'Early commercial',
    short: 'Early',
    trl: [8, 8],
    evidence: 'A product launch or first commercial order, from the seller or the buyer.',
  },
  {
    id: 'scale',
    label: 'At scale',
    short: 'Scale',
    trl: [9, 9],
    evidence: 'A filing or company report of volume production.',
  },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]['id'];

export const STAGE_IDS: readonly PipelineStage[] = PIPELINE_STAGES.map((s) => s.id);

export const PIPELINE_STAGE_LABEL = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.id, s.label]),
) as Record<PipelineStage, string>;

/** The stage a readiness level (1–9) falls in. */
export function stageForReadiness(level: number): PipelineStage {
  const found = PIPELINE_STAGES.find((s) => level >= s.trl[0] && level <= s.trl[1]);
  return found?.id ?? 'fundamental';
}

/**
 * What the feeds search for, per bottleneck.
 *
 * `phrases` are sent to every source and must appear, as a phrase, in a
 * title or abstract for an item to count. `context` words only add weight
 * when they appear in a title. A bottleneck with no entry is not searched,
 * and its page says so: some constraints (a licensing queue, a labour
 * market) have little laboratory science behind them, and a search that
 * returned something anyway would be noise dressed as coverage.
 */
export interface ScienceQuery {
  phrases: string[];
  context: string[];
  /** Words that mark another field using the same phrase; an item naming one is dropped. */
  exclude?: string[];
}

export const SCIENCE_QUERIES: Record<string, ScienceQuery> = {
  'EUV lithography scanners': {
    phrases: ['EUV lithography', 'extreme ultraviolet lithography', 'EUV scanner', 'EUV source'],
    context: ['euv', 'pellicle', 'reticle', 'photomask', 'nanoimprint', 'high-na'],
  },
  'EUV projection optics': {
    phrases: ['EUV mirror', 'EUV optics', 'multilayer mirror', 'Mo/Si multilayer'],
    context: ['euv', 'reflectivity', 'multilayer', 'optics'],
  },
  'Photoresist formulation': {
    phrases: ['photoresist', 'EUV resist', 'metal oxide resist', 'chemically amplified resist'],
    context: ['resist', 'lithography', 'patterning'],
  },
  'Advanced packaging capacity': {
    phrases: ['advanced packaging', 'chiplet', 'silicon interposer', 'fan-out wafer level'],
    context: ['packaging', 'interposer', 'heterogeneous', 'integration'],
  },
  'Leading-edge foundry capacity': {
    phrases: ['gate-all-around', 'nanosheet transistor', 'backside power delivery', 'CFET'],
    context: ['transistor', 'logic', 'node', 'cmos'],
  },
  'High-bandwidth memory stacking yield': {
    phrases: ['high bandwidth memory', 'hybrid bonding', 'through-silicon via', 'DRAM stacking'],
    context: ['hbm', 'dram', 'stack', 'bonding'],
    exclude: ['welding', 'weld', 'rivet'],
  },
  'Grain-oriented electrical steel (GOES)': {
    phrases: ['grain-oriented electrical steel', 'grain oriented silicon steel', 'amorphous core'],
    context: ['transformer', 'core loss', 'magnetic', 'steel'],
  },
  'High-voltage cable and switchgear': {
    phrases: [
      'HVDC cable',
      'high voltage cable',
      'SF6-free switchgear',
      'gas-insulated switchgear',
    ],
    context: ['hvdc', 'insulation', 'switchgear', 'cable'],
  },
  'Large power transformer slots': {
    phrases: ['power transformer', 'solid-state transformer', 'transformer insulation'],
    context: ['transformer', 'grid', 'substation'],
  },
  'Uranium conversion and enrichment': {
    phrases: ['uranium enrichment', 'HALEU', 'laser isotope separation', 'uranium conversion'],
    context: ['uranium', 'enrichment', 'centrifuge', 'fuel'],
  },
  'Heavy-duty gas turbine order books': {
    phrases: ['gas turbine', 'hydrogen combustion turbine', 'turbine blade superalloy'],
    context: ['turbine', 'combustor', 'superalloy'],
  },
  'Liquid helium (He-4)': {
    phrases: ['helium recovery', 'helium liquefaction', 'helium extraction', 'cryogen-free'],
    context: ['helium', 'cryogenic', 'liquefier'],
  },
  'REBCO superconducting tape, 12 mm': {
    phrases: ['REBCO', 'coated conductor', 'high-temperature superconducting tape', 'HTS tape'],
    context: ['superconducting', 'hts', 'yba2cu3o', 'magnet'],
  },
  'Two-phase dielectric immersion coolant': {
    phrases: ['two-phase immersion cooling', 'immersion cooling', 'dielectric coolant'],
    context: ['immersion', 'dielectric', 'boiling', 'data center'],
  },
  'Crucible-grade high-purity quartz sand': {
    phrases: ['high-purity quartz', 'quartz crucible', 'synthetic silica crucible'],
    context: ['quartz', 'crucible', 'czochralski'],
  },
  '300 mm prime silicon wafers': {
    phrases: ['300 mm wafer', 'Czochralski silicon', 'silicon wafer defect'],
    context: ['wafer', 'czochralski', 'silicon'],
  },
  'Battery-grade lithium chemicals': {
    phrases: [
      'direct lithium extraction',
      'lithium hydroxide',
      'lithium carbonate',
      'lithium refining',
    ],
    context: ['lithium', 'brine', 'extraction'],
  },
  'Neon, excimer laser grade': {
    phrases: ['neon recycling', 'neon recovery', 'excimer laser gas', 'ArF excimer'],
    context: ['neon', 'excimer', 'krf', 'arf'],
  },
  'Ruthenium, sputtering and ALD grade': {
    phrases: ['ruthenium interconnect', 'ruthenium atomic layer deposition', 'Ru interconnect'],
    context: ['ruthenium', 'interconnect', 'ald', 'metallization'],
  },
  'Electronic-grade polysilicon': {
    phrases: ['electronic-grade polysilicon', 'Siemens process', 'polysilicon purification'],
    context: ['polysilicon', 'trichlorosilane', 'purity'],
  },
  'High-purity tin, EUV droplet grade': {
    phrases: ['tin droplet', 'laser-produced plasma', 'EUV light source'],
    context: ['tin', 'droplet', 'plasma', 'euv'],
  },
  'Gallium, refined': {
    phrases: ['gallium recovery', 'gallium extraction', 'gallium refining'],
    context: ['gallium', 'bayer', 'recovery'],
  },
  'Silicon carbide substrate, 200 mm semi-insulating': {
    phrases: [
      'silicon carbide substrate',
      'SiC crystal growth',
      '200 mm SiC',
      'semi-insulating SiC',
    ],
    context: ['sic', 'substrate', 'boule', 'crystal'],
  },
  'CVD synthetic diamond heat spreader': {
    phrases: [
      'CVD diamond',
      'diamond heat spreader',
      'GaN-on-diamond',
      'diamond thermal management',
    ],
    context: ['diamond', 'thermal', 'heat spreader'],
  },
  'Didymium (Nd-Pr) metal, magnet feed': {
    phrases: ['rare earth separation', 'NdPr', 'neodymium praseodymium', 'rare earth recycling'],
    context: ['neodymium', 'rare earth', 'separation'],
  },
  'Dysprosium metal': {
    phrases: ['dysprosium', 'grain boundary diffusion', 'heavy rare earth free magnet'],
    context: ['dysprosium', 'terbium', 'coercivity'],
  },
  'Rare-earth magnet sintering': {
    phrases: ['sintered NdFeB', 'Nd-Fe-B magnet', 'rare-earth-free magnet', 'iron nitride magnet'],
    context: ['magnet', 'ndfeb', 'coercivity', 'sintering'],
  },
  'Precision reduction drives': {
    phrases: ['harmonic drive', 'strain wave gear', 'cycloidal reducer', 'robot joint reducer'],
    context: ['reducer', 'gear', 'robot', 'actuator'],
  },
  'Laser powder-bed fusion machines': {
    phrases: ['laser powder bed fusion', 'selective laser melting', 'metal additive manufacturing'],
    context: ['additive', 'lpbf', 'powder'],
  },
  'Robot-grade encoders and force sensors': {
    phrases: ['robot force sensor', 'six-axis force sensor', 'tactile sensor', 'optical encoder'],
    context: ['sensor', 'encoder', 'robot', 'tactile'],
  },
  'Grid interconnection queues': {
    phrases: ['interconnection queue', 'grid interconnection', 'hosting capacity'],
    context: ['interconnection', 'grid', 'transmission'],
  },
  'SMR first-of-a-kind licensing': {
    phrases: ['small modular reactor', 'microreactor', 'SMR licensing'],
    context: ['reactor', 'nuclear', 'licensing'],
  },
};

/** The one bottleneck with no science query, and why — shown on its page. */
export const NOT_SEARCHED_WHY: Record<string, string> = {
  'Semiconductor process engineers':
    'A labour market. Papers about engineering education exist, but none of them moves this constraint the way a new material or machine would, so the feeds do not search it.',
};
