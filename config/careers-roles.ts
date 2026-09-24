/**
 * Role families: how Substrata groups the jobs these chains hire for, and the
 * public occupational records each family is read against.
 *
 * A family is a reader's question ("I am an electrician — is anyone here
 * hiring me?"), not an official classification. Each one points at the
 * official occupations that describe it — O*NET-SOC codes for the US, ESCO
 * occupation URIs for the EU — and `scripts/research/occupations.ts` pulls
 * their skills from those two public sources into research/occupations.json.
 * Nothing about a skill is written here.
 *
 * `titleTerms` decide which family a posting lands in, from its title alone,
 * first match wins in the order below. They are Substrata's rule, shown on
 * /data#method-careers-classify, and can be wrong about any one posting.
 */

export const ROLE_FAMILY_IDS = [
  'process-engineering',
  'equipment-service',
  'technicians',
  'optics-photonics',
  'materials',
  'electrical-trades',
  'power-engineering',
  'nuclear',
  'gases-cryogenics',
  'mechatronics',
  'data-centre',
  'software-ai',
  'business',
] as const;

export type RoleFamilyId = (typeof ROLE_FAMILY_IDS)[number];

export interface Occupation {
  /** O*NET-SOC code, or null for an ESCO-only record. */
  onet: string | null;
  /** ESCO occupation URI, or null for an O*NET-only record. */
  esco: string | null;
}

export interface RoleFamily {
  id: RoleFamilyId;
  label: string;
  /** One line a job seeker recognises themselves in. */
  who: string;
  /** Lower-case phrases matched against a posting title, as whole words. */
  titleTerms: readonly string[];
  occupations: readonly Occupation[];
}

const esco = (id: string) => `http://data.europa.eu/esco/occupation/${id}`;

export const ROLE_FAMILIES: readonly RoleFamily[] = [
  {
    id: 'process-engineering',
    label: 'Process and yield engineering',
    who: 'Engineers who make a fab, a refinery or a line produce more good parts.',
    titleTerms: [
      'process engineer',
      'process engineering',
      'process integration',
      'integration engineer',
      'yield',
      'etch',
      'deposition',
      'lithography engineer',
      'litho engineer',
      'cmp',
      'diffusion engineer',
      'implant engineer',
      'thin film',
      'device engineer',
      'metrology engineer',
      'packaging engineer',
      'process development',
      'process technology',
    ],
    occupations: [
      { onet: '17-2072.00', esco: esco('8c0f59c9-9a47-42e7-8287-aab19df4e6ab') },
      { onet: '17-2199.06', esco: null },
      { onet: '17-2041.00', esco: esco('ec21ce88-ce14-49b6-be0a-cc53cf5a3a67') },
    ],
  },
  {
    id: 'equipment-service',
    label: 'Field service and equipment',
    who: 'People who install, keep running and repair the machines at a customer’s site.',
    titleTerms: [
      'field service',
      'service engineer',
      'customer engineer',
      'customer support engineer',
      'installation engineer',
      'installation technician',
      'equipment engineer',
      'equipment engineering',
      'service technician',
      'maintenance engineer',
      'maintenance technician',
      'commissioning',
      'field engineer',
      'applications engineer',
    ],
    occupations: [
      { onet: '49-2094.00', esco: esco('98e58946-3227-4f6c-a5d1-5892fe76883d') },
      { onet: '49-9041.00', esco: esco('269c47e7-9017-4aa6-bce8-49e89a696a64') },
    ],
  },
  {
    id: 'technicians',
    label: 'Technicians and operators',
    who: 'Hands on the line: running, checking and fixing production — often no degree needed.',
    titleTerms: [
      'technician',
      'operator',
      'manufacturing associate',
      'production associate',
      'fab associate',
      'assembler',
      'inspector',
    ],
    occupations: [
      { onet: '51-9141.00', esco: esco('140613c4-8c3c-43c5-8525-2f63231c95b0') },
      { onet: '17-3023.00', esco: esco('0ea36a48-a27d-4515-b61f-3cab395cf60f') },
    ],
  },
  {
    id: 'optics-photonics',
    label: 'Optics, lasers and photonics',
    who: 'Designing, building and aligning the optics and light sources inside the tools.',
    titleTerms: ['optical', 'optics', 'photonics', 'laser', 'euv source'],
    occupations: [
      { onet: '17-2199.07', esco: esco('778c1d37-69f2-4184-ac98-03b7dbfba332') },
      { onet: '17-3029.08', esco: esco('250d6493-68ab-4d69-ba67-c10293a20f49') },
    ],
  },
  {
    id: 'materials',
    label: 'Materials, chemistry and metallurgy',
    who: 'Scientists and engineers who make, purify and characterise the materials.',
    titleTerms: [
      'materials scientist',
      'materials engineer',
      'material scientist',
      'metallurg',
      'chemist',
      'chemical engineer',
      'ceramic',
      'crystal growth',
      'analytical scientist',
      'r&d scientist',
      'research scientist, materials',
      'geologist',
      'mining engineer',
    ],
    occupations: [
      { onet: '19-2032.00', esco: esco('4a375b68-88a0-4e5f-99ce-9b01341dfb81') },
      { onet: '17-2131.00', esco: esco('bcf8f332-c7e1-4a08-8651-28d668290eaf') },
      { onet: '19-2031.00', esco: esco('0d93706d-32fd-4de3-aa08-be1003e325da') },
    ],
  },
  {
    id: 'electrical-trades',
    label: 'Electricians and lineworkers',
    who: 'Licensed trades who wire plants, substations and the lines between them.',
    titleTerms: [
      'electrician',
      'lineworker',
      'lineman',
      'line worker',
      'cable jointer',
      'jointer',
      'wireman',
      'journeyman',
      'substation technician',
      'relay technician',
      'high voltage technician',
      'electrical technician',
    ],
    occupations: [
      { onet: '47-2111.00', esco: esco('5df63943-f1bc-4438-90f1-92768a7a23c8') },
      { onet: '49-9051.00', esco: esco('7052fd94-f563-46a9-8e2d-cba6c20f3e71') },
      { onet: '49-2095.00', esco: null },
    ],
  },
  {
    id: 'power-engineering',
    label: 'Power and grid engineering',
    who: 'Engineers who design, study and connect generation, transformers and the grid.',
    titleTerms: [
      'power systems',
      'power system',
      'electrical engineer',
      'electrical engineering',
      'electrical design',
      'grid',
      'interconnection',
      'protection engineer',
      'transmission',
      'substation engineer',
      'high voltage',
      'hvdc',
      'transformer',
      'switchgear',
      'energy engineer',
      'power engineer',
    ],
    occupations: [
      { onet: '17-2071.00', esco: esco('ac37627c-a999-4779-997e-9795cc4f9a3d') },
      { onet: '51-8012.00', esco: esco('f1b89616-5dfe-40d4-8b02-58a6982b1a01') },
    ],
  },
  {
    id: 'nuclear',
    label: 'Nuclear',
    who: 'Reactor, fuel-cycle and licensing work, from technician to engineer.',
    titleTerms: ['nuclear', 'reactor', 'radiation protection', 'health physics', 'enrichment'],
    occupations: [
      { onet: '17-2161.00', esco: esco('f14194e2-8e7f-4fc9-9c8c-78d9ae2e7284') },
      { onet: '19-4051.00', esco: esco('774ad663-2124-4ac2-a287-5fb2e478906e') },
    ],
  },
  {
    id: 'gases-cryogenics',
    label: 'Industrial gases and cryogenics',
    who: 'Running the plants and cold systems that separate, purify and ship helium, neon and the rest.',
    titleTerms: [
      'cryogenic',
      'cryogenics',
      'helium',
      'industrial gas',
      'air separation',
      'gas plant',
    ],
    occupations: [{ onet: '51-8092.00', esco: null }],
  },
  {
    id: 'mechatronics',
    label: 'Mechanical, robotics and manufacturing',
    who: 'Machines that move: mechanical design, robotics, controls, machining, printing metal.',
    titleTerms: [
      'mechanical engineer',
      'mechanical design',
      'robotics',
      'mechatronics',
      'controls engineer',
      'automation',
      'cnc',
      'machinist',
      'additive',
      'manufacturing engineer',
      'hardware engineer',
      'mechanical',
    ],
    occupations: [
      { onet: '17-2199.08', esco: esco('551a6797-3ca9-41fc-9dca-9a982a8fd8a6') },
      { onet: '17-3024.01', esco: esco('7833d5cd-873d-4fdd-b2f8-9762d68494a7') },
      { onet: '51-4041.00', esco: esco('02d4f153-8e43-444d-8bd4-8171d49eab12') },
    ],
  },
  {
    id: 'data-centre',
    label: 'Data-centre operations',
    who: 'Keeping the halls running: racks, power, cooling, and the people on shift.',
    titleTerms: [
      'data center',
      'data centre',
      'datacenter',
      'critical facilities',
      'critical facility',
      'mission critical',
      'facilities engineer',
      'facility engineer',
      'cooling',
      'hvac',
    ],
    occupations: [
      { onet: '49-9021.00', esco: esco('9729c0f3-c9bc-482e-ac59-a82ec3b67ba3') },
      { onet: '15-1231.00', esco: null },
    ],
  },
  {
    id: 'software-ai',
    label: 'Software, data and AI',
    who: 'Software, machine learning, data and infrastructure engineering.',
    titleTerms: [
      'software',
      'machine learning',
      'ml',
      'ai',
      'research engineer',
      'research scientist',
      'data scientist',
      'data engineer',
      'infrastructure',
      'sre',
      'site reliability',
      'security engineer',
      'developer',
      'firmware',
      'network engineer',
    ],
    occupations: [
      { onet: '15-1252.00', esco: esco('f2b15a0e-e65a-438a-affb-29b9d50b77d1') },
      { onet: '15-2051.00', esco: esco('258e46f9-0075-4a2e-adae-1ff0477e0f30') },
    ],
  },
  {
    id: 'business',
    label: 'Business and other roles',
    who: 'Sales, supply chain, finance, legal, people — any title the rules above do not match.',
    titleTerms: [],
    occupations: [],
  },
];

export const FAMILY_BY_ID = new Map(ROLE_FAMILIES.map((f) => [f.id, f]));

/**
 * The role families each bottleneck needs to grow — Substrata's judgement,
 * dated, from what the bottleneck is (a machine needs field service, a
 * material needs metallurgists). Not reviewed by anyone who hires for it; the
 * postings counted on each page are the evidence that tests it.
 */
export const NEEDS_JUDGED_ON = '2026-09-24';

export const BOTTLENECK_NEEDS: Record<string, readonly RoleFamilyId[]> = {
  'euv-lithography-scanners': ['equipment-service', 'optics-photonics', 'mechatronics'],
  'euv-projection-optics': ['optics-photonics', 'materials', 'technicians'],
  'photoresist-formulation': ['materials', 'process-engineering', 'technicians'],
  'advanced-packaging-capacity': ['process-engineering', 'technicians', 'equipment-service'],
  'leading-edge-foundry-capacity': ['process-engineering', 'technicians', 'equipment-service'],
  'high-bandwidth-memory-stacking-yield': ['process-engineering', 'technicians', 'materials'],
  'grain-oriented-electrical-steel-goes': ['materials', 'technicians', 'process-engineering'],
  'high-voltage-cable-and-switchgear': ['electrical-trades', 'power-engineering', 'technicians'],
  'large-power-transformer-slots': ['power-engineering', 'electrical-trades', 'technicians'],
  'uranium-conversion-and-enrichment': ['nuclear', 'materials', 'technicians'],
  'heavy-duty-gas-turbine-order-books': ['mechatronics', 'equipment-service', 'power-engineering'],
  'liquid-helium-he-4': ['gases-cryogenics', 'technicians', 'equipment-service'],
  'rebco-superconducting-tape-12-mm': ['materials', 'process-engineering', 'technicians'],
  'two-phase-dielectric-immersion-coolant': ['data-centre', 'materials', 'mechatronics'],
  'crucible-grade-high-purity-quartz-sand': ['materials', 'technicians', 'process-engineering'],
  '300-mm-prime-silicon-wafers': ['materials', 'process-engineering', 'technicians'],
  'battery-grade-lithium-chemicals': ['materials', 'process-engineering', 'technicians'],
  'neon-excimer-laser-grade': ['gases-cryogenics', 'process-engineering', 'optics-photonics'],
  'ruthenium-sputtering-and-ald-grade': ['materials', 'process-engineering'],
  'electronic-grade-polysilicon': ['process-engineering', 'materials', 'technicians'],
  'high-purity-tin-euv-droplet-grade': ['materials', 'process-engineering'],
  'gallium-refined': ['materials', 'process-engineering', 'technicians'],
  'silicon-carbide-substrate-200-mm-semi-insulating': [
    'materials',
    'process-engineering',
    'technicians',
  ],
  'cvd-synthetic-diamond-heat-spreader': ['materials', 'process-engineering'],
  'didymium-nd-pr-metal-magnet-feed': ['materials', 'process-engineering', 'technicians'],
  'dysprosium-metal': ['materials', 'process-engineering'],
  'rare-earth-magnet-sintering': ['materials', 'technicians', 'mechatronics'],
  'precision-reduction-drives': ['mechatronics', 'technicians'],
  'laser-powder-bed-fusion-machines': ['mechatronics', 'optics-photonics', 'equipment-service'],
  'robot-grade-encoders-and-force-sensors': ['mechatronics', 'optics-photonics', 'technicians'],
  'semiconductor-process-engineers': ['process-engineering', 'equipment-service', 'technicians'],
  'grid-interconnection-queues': ['power-engineering', 'electrical-trades'],
  'smr-first-of-a-kind-licensing': ['nuclear', 'power-engineering'],
};
