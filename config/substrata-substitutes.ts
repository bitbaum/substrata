/**
 * Whether an alternative exists, and whether that is any help.
 *
 * The corpus scored "how hard to replace" 0–3 and stopped, which flattens the
 * only question a reader has. An alternative can exist and still be unavailable,
 * for reasons with completely different remedies and time constants:
 *
 *   physics        — no alternative exists at all. Money and time do not move it.
 *   qualification  — it works, and proving it works for THIS use takes years.
 *   capacity       — it works and is qualified; there is not enough of it.
 *   cost           — it works and nobody will pay what it costs.
 *   contract       — supply is committed to somebody else.
 *   regulation     — permitted elsewhere, not here.
 *
 * "There is no alternative" and "the alternative needs four years of
 * qualification and a new mill" lead a reader to opposite conclusions, and today
 * both render as a 3.
 */

export type Blocker = 'physics' | 'qualification' | 'capacity' | 'cost' | 'contract' | 'regulation';

export const BLOCKER_LABEL: Record<Blocker, string> = {
  physics: 'Physics — no alternative exists',
  qualification: 'Qualification — proving it for this use takes years',
  capacity: 'Capacity — not enough of it exists',
  cost: 'Cost — it works and nobody will pay',
  contract: 'Contract — supply is committed elsewhere',
  regulation: 'Regulation — permitted elsewhere, not here',
};

export type SubstituteStatus =
  | 'in use'
  | 'qualified, capacity-limited'
  | 'qualified for some uses'
  | 'demonstrated, not qualified'
  | 'laboratory'
  | 'none known';

export interface Substitute {
  /** Bottleneck slug. */
  material: string;
  /** What the alternative is, in plain words. */
  candidate: string;
  status: SubstituteStatus;
  /** Usually more than one applies. Order matters: the first is the binding one. */
  blockedBy: Blocker[];
  /** The nuance, which is the whole point of the record. */
  why: string;
  /** More than one where independent sources exist. */
  sources: string[];
  readOn: string;
}

export const SUBSTITUTES: readonly Substitute[] = [
  {
    material: 'liquid-helium-he-4',
    candidate: 'Any other coolant, below about 4 K',
    status: 'none known',
    blockedBy: ['physics'],
    why: 'Below roughly 4 kelvin nothing else stays liquid. USGS states it plainly: nothing substitutes for helium in cryogenic applications below −429 °F. This is the one case on the site where the answer is a law rather than a schedule — no amount of money or time produces an alternative, so relief has to come from using less, recovering more, or finding more helium.',
    sources: ['https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-helium.pdf'],
    readOn: '2026-09-17',
  },
  {
    material: 'liquid-helium-he-4',
    candidate: 'High-temperature superconducting magnets that run warmer',
    status: 'demonstrated, not qualified',
    blockedBy: ['qualification', 'capacity'],
    why: 'Where the helium is used to cool a superconductor rather than to reach the temperature for its own sake, a magnet that operates at higher temperature removes the need. USGS notes such superconductors are being developed for MRI. This displaces demand rather than substituting the material, and it is gated by the same REBCO tape supply the corpus already tracks — which is why it is a schedule, not a law.',
    sources: [
      'https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-helium.pdf',
      'https://www.shsctec.com/en/products/tape/',
    ],
    readOn: '2026-09-17',
  },
  {
    material: 'gallium-refined',
    candidate: 'Silicon or indium phosphide in the device, instead of gallium compounds',
    status: 'qualified for some uses',
    blockedBy: ['qualification', 'cost'],
    why: 'For some optoelectronic and RF parts another semiconductor will do, and for others the gallium compound is chosen precisely because nothing else has its properties. A substitution that works in one product line says nothing about the next: each device has to be requalified, which is the years, not the chemistry.',
    sources: ['https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-gallium.pdf'],
    readOn: '2026-09-17',
  },
  {
    material: 'gallium-refined',
    candidate: 'Primary production outside China',
    status: 'demonstrated, not qualified',
    blockedBy: ['capacity', 'cost'],
    why: 'This is not a substitute for the material but for the supplier, and it is the relevant one: gallium is recovered as a byproduct of bauxite and zinc processing, so the capacity exists wherever alumina is refined. Germany, Hungary and Kazakhstan all produced it and stopped, in 2016, 2015 and 2013 — the plants were not destroyed by physics but closed on price. Restarting is a capital decision, which is why export controls moved the price before they moved the supply.',
    sources: ['https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-gallium.pdf'],
    readOn: '2026-09-17',
  },
];

export function substitutesFor(material: string): Substitute[] {
  return SUBSTITUTES.filter((row) => row.material === material);
}

/** True when the corpus records that no alternative can exist, as opposed to none being ready. */
export function blockedByPhysics(material: string): boolean {
  return substitutesFor(material).some(
    (row) => row.status === 'none known' && row.blockedBy.includes('physics'),
  );
}
