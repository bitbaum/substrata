/** What the tools touched during one answer, and the environment they run in. */
import type { LeadHit } from '../sweep-queue';
import type { WebFinding, WebLookup } from '../chat-web';

/** A corpus row the answer read, for the "records read" list under it. */
export interface RecordRef {
  title: string;
  href: string;
  kind: string;
  evidence: string;
  primary: string[];
}

/**
 * Everything the tools touched during one answer, in three registers that are
 * never merged: corpus records, unreviewed sweep leads, unchecked web pages.
 */
export interface Ledger {
  records: Map<string, RecordRef>;
  leads: LeadHit[];
  web: WebFinding[];
  /** One line per call, in order, for the reader: "Looked up ASML". */
  trail: string[];
}

export function emptyLedger(): Ledger {
  return { records: new Map(), leads: [], web: [], trail: [] };
}

export interface ToolEnv {
  ledger: Ledger;
  signal?: AbortSignal;
  /** Bottleneck names the signed-in reader follows. Undefined when signed out. */
  rails?: string[];
  /** Injected so tests need neither a database nor a network. */
  leads?: (q: { bottlenecks?: string[]; query?: string; days?: number }) => Promise<LeadHit[]>;
  web?: (query: string, signal?: AbortSignal) => Promise<WebLookup>;
}

export function remember(ledger: Ledger, ref: RecordRef) {
  if (!ledger.records.has(ref.href)) ledger.records.set(ref.href, ref);
}
