/**
 * The shapes of a company's exposure. Design:
 * docs/architecture/2026-10-27-company-exposure.md.
 *
 * Kept free of React and of the corpus modules so the page, the Ask and the
 * tests can all depend on it. Every edge carries its grade, and a grade other
 * than `stated` or `corroborated` is shown as what it is, never counted as a
 * fact (lib/graph/types.ts).
 */
import type { Horizon } from '@/config/substrata-assessment';
import type { SubstituteStatus, Blocker } from '@/config/substrata-substitutes';
import type { EvidenceGrade } from '@/lib/graph/types';

/** The four edges of the model. `holds` is today's meaning; the others are new on the page. */
export const EXPOSURE_EDGES = ['depends_on', 'constrains', 'holds', 'substitutes'] as const;
export type ExposureEdge = (typeof EXPOSURE_EDGES)[number];

/** One source behind an edge: a page that was opened, the sentence, the day. */
export interface ExposureSource {
  url: string;
  quote: string;
  readOn: string;
  /** Where the source is narrower or broader than the edge. */
  scope?: string;
}

/** A bottleneck as a row of this model needs to show it. */
export interface ChokepointRef {
  name: string;
  slug: string;
  /** The assessment's sum, of 12. */
  binding: number;
  horizon: Horizon;
}

/** An organisation on the other end of an edge. */
export interface Party {
  name: string;
  /** Null when it has no page under Markets. */
  slug: string | null;
  /** `stated` when a source names this party; `derived` when it follows from two stated rows. */
  grade: EvidenceGrade;
  /** One plain sentence: why this party is on the edge. */
  basis: string;
  /** Verbatim sources. A derived party may have none of its own: its `chain` is the evidence. */
  sources: ExposureSource[];
  /** For a derived party: the stated rows it follows from, one plain line each. */
  chain: string[];
}

/** A maker of the chokepoint. A part supplier is never counted as a second source. */
export interface Maker extends Party {
  role: string;
  supplier: boolean;
}

/** A written alternative from `config/substrata-substitutes.ts`. */
export interface Alternative {
  candidate: string;
  status: SubstituteStatus;
  blockedBy: Blocker[];
  why: string;
  sources: string[];
}

/** One row of "Constrained by": a chokepoint the company rests on. */
export interface Dependence {
  chokepoint: ChokepointRef;
  /** `needs`: cannot run without it. `sells-into`: its market is the holders' capacity. */
  relation: 'needs' | 'sells-into';
  /**
   * `stated`: the company's own filing or page says it. `derived`: the company
   * holds something that needs this (its inputs), worked out from two rows.
   */
  grade: EvidenceGrade;
  /** The company's own sentence(s), or for a derived row the input row's. */
  evidence: ExposureSource[];
  /** For a derived row: the chokepoint it holds that needs this one. */
  via: string | null;
  /** Who holds the chokepoint. Makers first, named ones before the rest. */
  makers: Maker[];
  /** A maker with no other maker recorded. "Recorded" is the whole claim. */
  soleRecorded: boolean;
  /** Written alternatives, with what blocks each. Empty is "none written", not "none exist". */
  alternatives: Alternative[];
  /** The assessment's own two tests, 0–3, in words a reader can check. */
  judged: { substitution: number; leadTime: number; on: string };
  /** What the chokepoint itself rests on, nearest first. */
  behind: ChokepointRef[];
}

/** One organisation that waits on something the company holds. */
export interface Waiting extends Party {
  /** `needs`: cannot run without it. `sells-into`: its market is the holder's capacity. */
  relation: 'needs' | 'sells-into';
}

/** One row of "Constrains": a chokepoint the company holds, and who waits on it. */
export interface Constraint {
  chokepoint: ChokepointRef;
  step: string;
  supplier: boolean;
  /** Companies whose own sources say they need it, or sell into it. */
  waiting: Waiting[];
  /** Chokepoints that need this one as an input. */
  feeds: ChokepointRef[];
  /** Companies one step further: they need something that needs this. Derived. */
  reached: Waiting[];
}

/** Customers and suppliers a source names directly, from the relation graph. */
export interface NamedParty extends Party {
  direction: 'supplier' | 'customer';
}

/** What is not known, and the task that would find it. */
export interface Unknown {
  side: 'constrained-by' | 'constrains' | 'alternatives';
  /** What is missing, in one plain sentence. */
  missing: string;
  /** Dossier box whose task fills it (`suppliers`, `customers`). */
  box: 'suppliers' | 'customers';
}

export interface CompanyExposure {
  slug: string;
  name: string;
  /** Hardest-binding first. */
  constrainedBy: Dependence[];
  constrains: Constraint[];
  /** What it holds outright: today's meaning. */
  holds: { chokepoint: ChokepointRef; step: string; supplier: boolean }[];
  /** Named by a source but on no chokepoint: customers and suppliers of the relation graph. */
  named: NamedParty[];
  unknown: Unknown[];
  counts: {
    /** Chokepoints it rests on. */
    exposedTo: number;
    /** Distinct organisations whose sources say they wait on what it holds, directly. */
    constrainsOrganisations: number;
    /** Chokepoints that need what it holds. */
    constrainsChokepoints: number;
    holds: number;
    tracked: number;
  };
}
