/**
 * The words that tie a job posting to a bottleneck, and the skill and
 * certification terms counted across postings.
 *
 * Both lists are Substrata's rules, not anybody's taxonomy. A posting is
 * filed under a bottleneck when its title names one of that bottleneck's
 * terms, or its description names them at least twice (one mention in a
 * company's boilerplate is not a job about it). Software and business
 * postings are filed by title alone (lib/careers.ts, TITLE_ONLY). The rule is on
 * /data#method-careers-classify and the code is lib/careers.ts; a wrong
 * filing is fixed by editing a term here, never by editing a posting.
 *
 * Terms are lower-case and matched as whole words or phrases, so "tin" does
 * not match "testing" — and plain "tin" is still left out, because it is also
 * a tax number. Ambiguous words that would drown a rail in noise ("transformer"
 * alone is an AI architecture as often as a grid machine) are only used inside
 * longer phrases.
 */

export const BOTTLENECK_TERMS: Record<string, readonly string[]> = {
  'euv-lithography-scanners': ['euv', 'extreme ultraviolet', 'lithography scanner', 'scanner'],
  'euv-projection-optics': ['euv optics', 'projection optics', 'multilayer coating', 'euv mirror'],
  'photoresist-formulation': ['photoresist', 'resist formulation', 'lithography materials'],
  'advanced-packaging-capacity': [
    'advanced packaging',
    'cowos',
    'hybrid bonding',
    'chiplet',
    'interposer',
    'flip chip',
    'wafer-level packaging',
    'fan-out',
    'osat',
    '3d packaging',
    '2.5d',
  ],
  'leading-edge-foundry-capacity': [
    'foundry',
    'wafer fab',
    'fab',
    'finfet',
    'gate-all-around',
    'process integration',
  ],
  'high-bandwidth-memory-stacking-yield': [
    'hbm',
    'high bandwidth memory',
    'high-bandwidth memory',
    'through-silicon via',
    'tsv',
    'dram',
  ],
  'grain-oriented-electrical-steel-goes': [
    'electrical steel',
    'grain-oriented',
    'grain oriented',
    'silicon steel',
    'transformer core',
  ],
  'high-voltage-cable-and-switchgear': [
    'switchgear',
    'high voltage cable',
    'high-voltage cable',
    'hv cable',
    'hvdc',
    'cable jointer',
    'jointer',
    'submarine cable',
    'gas-insulated',
  ],
  'large-power-transformer-slots': [
    'power transformer',
    'power transformers',
    'transformer factory',
    'transformer design',
    'transformer engineer',
    'transformer test',
    'transformer manufacturing',
    'transformer technician',
    'substation',
  ],
  'uranium-conversion-and-enrichment': [
    'uranium',
    'enrichment',
    'centrifuge',
    'nuclear fuel',
    'fuel cycle',
    'haleu',
  ],
  'heavy-duty-gas-turbine-order-books': [
    'gas turbine',
    'gas turbines',
    'combined cycle',
    'turbine',
  ],
  'liquid-helium-he-4': ['helium', 'cryogenic', 'cryogenics', 'liquefaction'],
  'rebco-superconducting-tape-12-mm': [
    'superconductor',
    'superconducting',
    'rebco',
    'hts tape',
    'hts wire',
  ],
  'two-phase-dielectric-immersion-coolant': [
    'immersion cooling',
    'liquid cooling',
    'dielectric fluid',
    'direct-to-chip',
    'two-phase cooling',
    'coolant distribution',
  ],
  'crucible-grade-high-purity-quartz-sand': ['high-purity quartz', 'quartz crucible', 'quartz'],
  '300-mm-prime-silicon-wafers': [
    'silicon wafer',
    'silicon wafers',
    'wafer manufacturing',
    'czochralski',
    'crystal pulling',
    'prime wafer',
    'wafer polishing',
  ],
  'battery-grade-lithium-chemicals': [
    'lithium',
    'lithium hydroxide',
    'spodumene',
    'battery-grade',
    'cathode',
  ],
  'neon-excimer-laser-grade': ['neon', 'excimer', 'rare gas', 'rare gases'],
  'ruthenium-sputtering-and-ald-grade': [
    'ruthenium',
    'sputtering target',
    'sputtering targets',
    'ald precursor',
    'precursors',
  ],
  'electronic-grade-polysilicon': ['polysilicon', 'polycrystalline silicon', 'trichlorosilane'],
  'high-purity-tin-euv-droplet-grade': [
    'high-purity tin',
    'tin smelting',
    'tin refining',
    'tin droplet',
  ],
  'gallium-refined': ['gallium', 'gallium nitride', 'gan', 'gaas', 'gallium arsenide'],
  'silicon-carbide-substrate-200-mm-semi-insulating': [
    'silicon carbide',
    'sic',
    'sic substrate',
    'sic crystal',
    'crystal growth',
  ],
  'cvd-synthetic-diamond-heat-spreader': [
    'cvd diamond',
    'synthetic diamond',
    'lab-grown diamond',
    'diamond',
  ],
  'didymium-nd-pr-metal-magnet-feed': [
    'rare earth',
    'rare earths',
    'rare-earth',
    'neodymium',
    'ndpr',
    'nd-pr',
    'praseodymium',
  ],
  'dysprosium-metal': ['dysprosium', 'terbium', 'heavy rare earth', 'heavy rare earths'],
  'rare-earth-magnet-sintering': [
    'ndfeb',
    'permanent magnet',
    'permanent magnets',
    'magnet manufacturing',
    'sintered magnet',
    'sintering',
  ],
  'precision-reduction-drives': [
    'reducer',
    'reducers',
    'harmonic drive',
    'strain wave',
    'cycloidal',
    'reduction gear',
    'gearbox',
  ],
  'laser-powder-bed-fusion-machines': [
    'additive manufacturing',
    'powder bed',
    'lpbf',
    'metal 3d printing',
    '3d printing',
  ],
  'robot-grade-encoders-and-force-sensors': [
    'encoder',
    'encoders',
    'force sensor',
    'torque sensor',
    'force-torque',
  ],
  'semiconductor-process-engineers': [
    'process engineer',
    'process integration engineer',
    'yield engineer',
    'etch engineer',
    'deposition engineer',
    'cmp engineer',
    'diffusion engineer',
    'implant engineer',
    'lithography engineer',
    'litho engineer',
    'thin film engineer',
    'metrology engineer',
  ],
  'grid-interconnection-queues': [
    'interconnection',
    'grid connection',
    'transmission planning',
    'load flow',
    'power flow',
    'utility interconnect',
    'interconnect studies',
  ],
  'smr-first-of-a-kind-licensing': [
    'small modular reactor',
    'smr',
    'nuclear licensing',
    'reactor licensing',
    'nrc',
    'licensing engineer',
    'advanced reactor',
  ],
};

/**
 * Skills, tools and credentials counted across postings. `kind` separates a
 * credential a reader can go and earn from a skill they describe themselves
 * with. The label is what a reader sees; the terms are what is matched.
 */
export interface SkillTerm {
  label: string;
  kind: 'skill' | 'credential';
  terms: readonly string[];
}

export const SKILL_TERMS: readonly SkillTerm[] = [
  { label: 'Cleanroom work', kind: 'skill', terms: ['cleanroom', 'clean room'] },
  {
    label: 'Statistical process control',
    kind: 'skill',
    terms: ['spc', 'statistical process control'],
  },
  { label: 'Design of experiments', kind: 'skill', terms: ['design of experiments'] },
  { label: 'FMEA / root-cause analysis', kind: 'skill', terms: ['fmea', 'root cause', '8d'] },
  {
    label: 'Lean / Six Sigma',
    kind: 'credential',
    terms: ['six sigma', 'lean manufacturing', 'green belt', 'black belt'],
  },
  { label: 'Lithography', kind: 'skill', terms: ['lithography', 'photolithography'] },
  {
    label: 'Etch / deposition (CVD, PVD, ALD)',
    kind: 'skill',
    terms: ['etch', 'cvd', 'pvd', 'ald', 'deposition'],
  },
  {
    label: 'Metrology and inspection',
    kind: 'skill',
    terms: ['metrology', 'sem', 'tem', 'xrd', 'ellipsometry'],
  },
  { label: 'Vacuum systems', kind: 'skill', terms: ['vacuum', 'vacuum systems', 'uhv'] },
  { label: 'PLC and industrial controls', kind: 'skill', terms: ['plc', 'plcs', 'scada', 'hmi'] },
  {
    label: 'Schematics and electrical troubleshooting',
    kind: 'skill',
    terms: ['schematics', 'troubleshooting', 'troubleshoot'],
  },
  {
    label: 'Pneumatics and hydraulics',
    kind: 'skill',
    terms: ['pneumatic', 'pneumatics', 'hydraulic', 'hydraulics'],
  },
  {
    label: 'CAD (SolidWorks, AutoCAD, Creo, NX)',
    kind: 'skill',
    terms: ['cad', 'solidworks', 'autocad', 'creo', 'siemens nx'],
  },
  {
    label: 'Power-system studies (PSS/E, ETAP, PSCAD)',
    kind: 'skill',
    terms: ['pss/e', 'psse', 'etap', 'pscad', 'powerfactory'],
  },
  {
    label: 'Protection and relays',
    kind: 'skill',
    terms: ['protection and control', 'relay', 'relays', 'protective relaying'],
  },
  {
    label: 'High-voltage work',
    kind: 'skill',
    terms: ['high voltage', 'high-voltage', 'medium voltage', 'medium-voltage'],
  },
  { label: 'Cryogenics', kind: 'skill', terms: ['cryogenic', 'cryogenics', 'liquid nitrogen'] },
  { label: 'Optics and lasers', kind: 'skill', terms: ['optics', 'optical alignment', 'laser'] },
  {
    label: 'Materials characterisation',
    kind: 'skill',
    terms: ['characterization', 'characterisation', 'spectroscopy'],
  },
  { label: 'Python', kind: 'skill', terms: ['python'] },
  { label: 'C / C++', kind: 'skill', terms: ['c++'] },
  { label: 'MATLAB / LabVIEW', kind: 'skill', terms: ['matlab', 'labview'] },
  { label: 'Kubernetes / Linux operations', kind: 'skill', terms: ['kubernetes', 'linux'] },
  {
    label: 'Electrical licence / journeyman card',
    kind: 'credential',
    terms: ['journeyman', 'master electrician', 'electrical license', 'electrical licence'],
  },
  { label: 'Apprenticeship completed', kind: 'credential', terms: ['apprenticeship'] },
  {
    label: 'NFPA 70E / arc-flash',
    kind: 'credential',
    terms: ['nfpa 70e', 'arc flash', 'arc-flash'],
  },
  { label: 'OSHA 10 / 30', kind: 'credential', terms: ['osha 10', 'osha 30', 'osha'] },
  {
    label: 'Professional Engineer (PE)',
    kind: 'credential',
    terms: ['professional engineer', 'pe license', 'p.e.'],
  },
  {
    label: 'IPC soldering / workmanship',
    kind: 'credential',
    terms: ['ipc-a-610', 'j-std-001', 'ipc'],
  },
  {
    label: 'Security clearance',
    kind: 'credential',
    terms: ['security clearance', 'secret clearance', 'ts/sci'],
  },
  {
    label: 'Commercial driving licence',
    kind: 'credential',
    terms: ['cdl', "commercial driver's license"],
  },
  {
    label: 'ISO 9001 / quality systems',
    kind: 'credential',
    terms: ['iso 9001', 'iatf 16949', 'as9100'],
  },
  {
    label: 'Bachelor’s degree asked',
    kind: 'credential',
    terms: ["bachelor's", 'bachelors', 'bachelor of', 'bs degree', 'b.s.'],
  },
  {
    label: 'Associate / technical diploma asked',
    kind: 'credential',
    terms: ["associate's degree", 'associate degree', 'technical diploma', 'vocational'],
  },
  { label: 'PhD asked', kind: 'credential', terms: ['phd', 'ph.d', 'doctorate'] },
];
