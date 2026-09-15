/**
 * The assessment: for every bottleneck, which stage of the loop it sits on,
 * how hard it binds, and when.
 *
 * The four tests are the mandate's own screen, each scored 0–3 where 3 is
 * worst for the loop: concentration (how few suppliers qualify), substitution
 * (how hard to replace), lead time (decision to new capacity), inelasticity
 * (can the buyer walk away). The sum, 0–12, is the binding score. The horizon
 * is when the row is expected to bind: now, within two years, or beyond.
 *
 * These are analyst judgements, not measurements. Every row says so, carries
 * the date it was judged, and a one-line rationale a reader can disagree
 * with. Observations (events) are what will move them; a score that never
 * moves against events is a score nobody is reading.
 *
 * Created: 2026-09-15
 */

import type { StageId } from './substrata-stages';

export type Horizon = 'now' | 'two-years' | 'beyond';

export interface BindingScore {
  concentration: 0 | 1 | 2 | 3;
  substitution: 0 | 1 | 2 | 3;
  leadTime: 0 | 1 | 2 | 3;
  inelasticity: 0 | 1 | 2 | 3;
}

export interface Assessment {
  /** Exact bottleneck name: a material title or a chokepoint name. */
  name: string;
  stage: StageId;
  score: BindingScore;
  horizon: Horizon;
  rationale: string;
  judgedOn: string;
}

const ON = '2026-09-15';

function a(
  name: string,
  stage: StageId,
  [concentration, substitution, leadTime, inelasticity]: [
    BindingScore['concentration'],
    BindingScore['substitution'],
    BindingScore['leadTime'],
    BindingScore['inelasticity'],
  ],
  horizon: Horizon,
  rationale: string,
): Assessment {
  return {
    name,
    stage,
    score: { concentration, substitution, leadTime, inelasticity },
    horizon,
    rationale,
    judgedOn: ON,
  };
}

export const ASSESSMENTS: readonly Assessment[] = [
  // ---------- Materials & tools ----------
  a(
    'High-purity tin, EUV droplet grade',
    'materials',
    [2, 3, 2, 3],
    'beyond',
    'Tin is plentiful; seven-nines upgrading for an EUV source is a few firms. No substitute for the droplet, but supply is not short today.',
  ),
  a(
    'Neon, excimer laser grade',
    'materials',
    [2, 3, 2, 3],
    'two-years',
    '2022 showed the map: separation rides on steelmaking and half of it sat in Ukraine. Recycling eased it; another shock would not be absorbed.',
  ),
  a(
    'Ruthenium, sputtering and ALD grade',
    'materials',
    [3, 2, 3, 2],
    'two-years',
    'A by-product of South African and Russian PGM mining, so supply cannot answer demand. Ruthenium interconnect at leading nodes is the demand shock.',
  ),
  a(
    'Electronic-grade polysilicon',
    'materials',
    [2, 3, 2, 3],
    'beyond',
    'Five producers at eleven nines; capacity is being added (Tokuyama Vietnam, OCI). Not binding, and the loosening events say so.',
  ),
  a(
    '300 mm prime silicon wafers',
    'materials',
    [3, 3, 2, 3],
    'two-years',
    'Five firms make every 300 mm wafer on earth. Long-term agreements cover the fabs; a demand step from new fabs is the risk.',
  ),
  a(
    'Crucible-grade high-purity quartz sand',
    'materials',
    [3, 2, 3, 3],
    'now',
    'One deposit at Spruce Pine supplies most inner-layer crucible sand; a 2024 hurricane closed it for weeks. Substitutes are synthetic and slow to qualify.',
  ),
  a(
    'Gallium, refined',
    'materials',
    [3, 1, 2, 2],
    'now',
    'China refines nearly all primary gallium and licenses its export. Substitution is possible for some uses, not for GaN.',
  ),
  a(
    'CVD synthetic diamond heat spreader',
    'materials',
    [2, 1, 1, 1],
    'beyond',
    'Several growers, and copper or SiC do the job for most parts today. Binds only if diamond becomes the standard spreader for high-power dies.',
  ),
  a(
    'Silicon carbide substrate, 200 mm semi-insulating',
    'materials',
    [2, 2, 2, 2],
    'beyond',
    'Capacity was overbuilt for automotive; a US wafer line is being liquidated. Not binding; watch for the datacentre power story to reverse it.',
  ),
  a(
    'Two-phase dielectric immersion coolant',
    'energy',
    [2, 2, 1, 1],
    'two-years',
    'The main supplier left fluorochemicals. Single-phase and water alternatives exist; the two-phase niche needs a new source.',
  ),
  a(
    'Grain-oriented electrical steel (GOES)',
    'energy',
    [2, 3, 3, 3],
    'now',
    'Every large transformer needs it, few mills make it, and a mill takes years. The transformer queue is partly a GOES queue.',
  ),
  a(
    'REBCO superconducting tape, 12 mm',
    'energy',
    [3, 2, 3, 2],
    'two-years',
    'A handful of tape makers; every fusion magnet programme is a customer. LTS substitutes at lower field.',
  ),
  a(
    'Liquid helium (He-4)',
    'energy',
    [2, 3, 2, 3],
    'two-years',
    'Qatar, the US and Russia; no substitute below 4 K. Recurring shortages, currently eased by new Qatari trains.',
  ),
  a(
    'Didymium (Nd-Pr) metal, magnet feed',
    'actuation',
    [3, 2, 3, 2],
    'now',
    'Mining is spreading; separation and metal-making are still almost entirely Chinese, and licensed. Ferrite and induction motors substitute at a cost.',
  ),
  a(
    'Dysprosium metal',
    'actuation',
    [3, 2, 3, 2],
    'now',
    'Heavy rare earth, Chinese and export-controlled since 2025. Grain-boundary diffusion reduces the need but does not remove it.',
  ),

  // ---------- Compute ----------
  a(
    'EUV lithography scanners',
    'compute',
    [3, 3, 3, 3],
    'now',
    'One maker, a multi-year queue, no second source in progress. The definition of a chokepoint.',
  ),
  a(
    'EUV projection optics',
    'compute',
    [3, 3, 3, 3],
    'now',
    'One optics maker inside the one scanner maker. The constraint is know-how, and it does not copy.',
  ),
  a(
    'Advanced packaging capacity',
    'compute',
    [3, 2, 3, 3],
    'now',
    'Accelerator output is set by CoWoS-class capacity, allocated years ahead. The allocation is the scarce good.',
  ),
  a(
    'High-bandwidth memory stacking yield',
    'compute',
    [3, 2, 2, 3],
    'now',
    'Three suppliers, and yield is knowledge. Every accelerator ships with it.',
  ),
  a(
    'Leading-edge foundry capacity',
    'compute',
    [3, 2, 3, 3],
    'now',
    'A handful of fabs at the newest node; new capacity is a multi-year, multi-billion commitment.',
  ),
  a(
    'Photoresist formulation',
    'compute',
    [3, 3, 3, 3],
    'two-years',
    'Japanese chemistry, qualified per process per fab. Binding whenever export policy touches it, quiet otherwise.',
  ),

  // ---------- Energy ----------
  a(
    'Large power transformer slots',
    'energy',
    [2, 3, 3, 3],
    'now',
    'Lead times of several years and no datacentre without one. Gates more announced compute than chips do.',
  ),
  a(
    'Grid interconnection queues',
    'permission',
    [2, 3, 3, 3],
    'now',
    'An administrative queue measured in years between a signed site and a live megawatt. Relief is a rule change, not a factory.',
  ),
  a(
    'Heavy-duty gas turbine order books',
    'energy',
    [3, 2, 3, 2],
    'now',
    'Three makers, order books sold out into the decade. The fastest route to firm power, and it is full.',
  ),
  a(
    'High-voltage cable and switchgear',
    'energy',
    [2, 3, 3, 3],
    'now',
    'Same lead times as transformers, same inability to answer a demand shock.',
  ),

  // ---------- Actuation ----------
  a(
    'Rare-earth magnet sintering',
    'actuation',
    [3, 2, 3, 2],
    'now',
    'Downstream of the mine and concentrated in one jurisdiction. Where the 2025 export controls actually bit.',
  ),
  a(
    'Precision reduction drives',
    'actuation',
    [3, 2, 2, 3],
    'two-years',
    'Harmonic and cycloidal drives from few qualified suppliers; a humanoid ramp is the demand shock.',
  ),
  a(
    'Robot-grade encoders and force sensors',
    'actuation',
    [2, 2, 2, 2],
    'beyond',
    'Narrow supply, per-application qualification, but several suppliers and no single point of failure.',
  ),

  // ---------- Talent ----------
  a(
    'Semiconductor process engineers',
    'talent',
    [2, 3, 3, 3],
    'now',
    'The constraint nobody can buy. Fab ramps move at the speed of people who have done one before.',
  ),
];

export function bindingScore(score: BindingScore): number {
  return score.concentration + score.substitution + score.leadTime + score.inelasticity;
}

export const HORIZON_LABEL: Record<Horizon, string> = {
  now: 'Binding now',
  'two-years': 'Within two years',
  beyond: 'Beyond two years',
};

const BY_NAME = new Map(ASSESSMENTS.map((item) => [item.name, item]));

export function assessmentFor(name: string): Assessment | undefined {
  return BY_NAME.get(name);
}
