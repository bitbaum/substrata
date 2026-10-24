/**
 * The second feed of the work queue: questions the Ask could not finish.
 *
 * When an answer ends at rung 6 of the answer ladder (an honest gap), it files
 * the gap here with `recordDemand(entity, box, question)`. Each filing raises
 * that box's `demand`, and the gaps script orders work by demand first, so the
 * order of work follows what people actually ask.
 *
 * There is no storage yet: this file is the typed seam. A store (a table, a
 * JSON log) implements `DemandLedger`; `memoryDemand()` is the in-memory
 * double the tests and the gaps script use until then.
 */
import type { SubjectId } from '@/lib/graph/types';

export interface DemandRecord {
  entity: SubjectId;
  box: string;
  question: string;
}

export interface DemandReader {
  /** How many questions needed this box. 0 for a box nobody has asked about. */
  count(entity: string, box: string): number;
}

export interface DemandLedger extends DemandReader {
  record(entity: SubjectId, box: string, question: string): void;
  /** Every record, oldest first. */
  all(): readonly DemandRecord[];
}

export const NO_DEMAND: DemandReader = { count: () => 0 };

/** An in-memory ledger. Questions are kept as asked; counting is per (entity, box). */
export function memoryDemand(): DemandLedger {
  const records: DemandRecord[] = [];
  const counts = new Map<string, number>();
  const key = (entity: string, box: string) => `${entity}#${box}`;
  return {
    record(entity, box, question) {
      const text = question.trim();
      if (!text) return;
      records.push({ entity, box, question: text });
      counts.set(key(entity, box), (counts.get(key(entity, box)) ?? 0) + 1);
    },
    count: (entity, box) => counts.get(key(entity, box)) ?? 0,
    all: () => records,
  };
}

let ledger: DemandLedger = memoryDemand();

/** Swap the process ledger (a store, or a fresh double in a test). Returns the previous one. */
export function useDemandLedger(next: DemandLedger): DemandLedger {
  const previous = ledger;
  ledger = next;
  return previous;
}

/** The ladder's one call: an unanswered question that needed `box` of `entity`. */
export function recordDemand(entity: SubjectId, box: string, question: string): void {
  ledger.record(entity, box, question);
}

/** The process ledger, read-only, for the gaps script. */
export function demandLedger(): DemandReader {
  return ledger;
}
