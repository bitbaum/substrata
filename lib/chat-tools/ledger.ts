/** What the tools touched during one answer, and the environment they run in. */
import type { LeadHit } from '../sweep-queue';
import type { JobFilter, JobRow } from '../careers-query';
import type { Filing } from '../filings';
import type { StoredItem } from '../science-read';
import type { WebFinding, WebLookup } from '../chat-web';
import type { AnswerTable } from '../chat/answer-table';
import type { AnswerChart } from '../chat/answer-chart';
import type { FetchDeps } from '../sources/http';

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
  /** Tables built in code from tool rows, drawn under the answer (lib/chat/answer-table.ts). */
  tables: AnswerTable[];
  /** Charts built in code from tool rows (prices, holders), drawn under the answer (lib/chat/answer-chart.ts). */
  charts: AnswerChart[];
}

export function emptyLedger(): Ledger {
  return { records: new Map(), leads: [], web: [], trail: [], tables: [], charts: [] };
}

export interface ToolEnv {
  ledger: Ledger;
  signal?: AbortSignal;
  /** Bottleneck names the signed-in reader follows. Undefined when signed out. */
  rails?: string[];
  /** Injected so tests need neither a database nor a network. */
  leads?: (q: { bottlenecks?: string[]; query?: string; days?: number }) => Promise<LeadHit[]>;
  web?: (query: string, signal?: AbortSignal, onRead?: (url: string) => void) => Promise<WebLookup>;
  /** A step the reader sees while it works ("Reading reuters.com…"), and keeps in the thought row. */
  step?: (label: string) => void;
  /** Read one cited source for the passage bearing on a claim (verify mode). */
  read?: (url: string, claim: string, signal?: AbortSignal) => Promise<WebFinding | null>;
  /** Open roles from the job board (careers-query `openJobs`). */
  jobs?: (filter: JobFilter, limit: number) => Promise<{ jobs: JobRow[]; total: number }>;
  /** Collected papers and grants on one bottleneck (science-read `itemsFor`). */
  science?: (bottleneck: string, limit: number) => Promise<StoredItem[]>;
  /** How market-data reads reach their sources; tests pass recorded responses (test/fixtures/market). */
  market?: FetchDeps;
  /** SEC filings by these registrants (filings-store `filingsFor`). */
  filings?: (ciks: readonly number[], days: number) => Promise<Filing[]>;
}

export function remember(ledger: Ledger, ref: RecordRef) {
  if (!ledger.records.has(ref.href)) ledger.records.set(ref.href, ref);
}
