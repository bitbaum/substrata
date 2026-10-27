/**
 * A chart an answer carries beside its prose, built in code from a tool's rows
 * — the price line, the holders' share bar — never written by the model.
 *
 * Asked how NVIDIA's shares had done over a year, the Ask once quoted a single
 * close from a web page. A chart the model writes depends on the model copying
 * 120 numbers faithfully; a chart a tool builds does not. So a tool returns
 * `chart` on its result, lib/chat-tools/registry.ts routes it to the answer
 * (as it does `table`), and the reader sees the figure under the prose, drawn
 * by chartkit through components/portal/chat/chartRenderers.tsx.
 *
 * Shared by the server and the browser: no imports with side effects.
 */
import { parseChartBlock, type ChartBlock } from '@bitbaum/chatkit';
import type { AnswerTable } from './answer-table';

export interface AnswerChart {
  id: string;
  block: ChartBlock;
  /** What a share bar's remainder is ("Others, each below 5%"): its legend label. */
  otherLabel?: string;
  /** The company page the figures belong on: the answer links "Open <name>" to it. */
  page?: { label: string; href: string };
  /** Where every figure in it comes from. */
  source: { label: string; url: string };
  /** What the reader must know to read it right (basis, delay, dates). */
  note: string;
}

/** Whether an unknown value is a chart this module describes; the browser checks before drawing. */
export function isAnswerChart(v: unknown): v is AnswerChart {
  if (!v || typeof v !== 'object') return false;
  const c = v as Partial<AnswerChart>;
  return (
    typeof c.id === 'string' &&
    typeof c.note === 'string' &&
    typeof c.source?.url === 'string' &&
    parseChartBlock(c.block) !== null
  );
}

/** The tables and charts an answer carries, for the done event (only the keys that have rows). */
export function extrasOf(ledger: { tables: AnswerTable[]; charts: AnswerChart[] }): {
  tables?: AnswerTable[];
  charts?: AnswerChart[];
} {
  return {
    ...(ledger.tables.length ? { tables: ledger.tables } : {}),
    ...(ledger.charts.length ? { charts: ledger.charts } : {}),
  };
}
