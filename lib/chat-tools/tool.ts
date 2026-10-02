/** The contract every chat tool implements, and its argument coercions. */
import type { ToolEnv } from './ledger';

export type Args = Record<string, unknown>;
export const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 200) : '');
export const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : fallback;
};

export interface ChatTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Short present-tense label shown to the reader while it runs. */
  label: (args: Args) => string;
  /** Whether this deployment can run it at all; a tool that cannot is not offered. */
  available?: (env: ToolEnv) => boolean;
  run: (args: Args, env: ToolEnv) => Promise<unknown>;
  /** Characters its result may take; the registry default when absent. */
  budget?: number;
}

/**
 * The names small models actually use for a tool's arguments, observed live
 * (2026-10-02): Gemini asked `get_bottleneck {"id": …}` and `search_corpus
 * {"kind": …, "query": …}`; others write `q`, `slug`, `term`. Refusing them
 * ran the tool empty ("Reading the  record"). A declared parameter that is
 * missing takes its value from the first alias present; nothing else changes.
 */
const ALIASES: Record<string, readonly string[]> = {
  name: ['id', 'slug', 'bottleneck', 'company', 'entity', 'title', 'record', 'key'],
  query: ['q', 'search', 'term', 'terms', 'keywords', 'text', 'topic', 'name'],
  bottleneck: ['name', 'id', 'slug'],
  company: ['name', 'id', 'slug', 'ticker'],
};

export function withAliases(parameters: Record<string, unknown>, args: Args): Args {
  const declared = Object.keys(
    ((parameters as { properties?: Record<string, unknown> }).properties ?? {}) as object,
  );
  const out: Args = { ...args };
  for (const key of declared) {
    if (str(out[key])) continue;
    const from = (ALIASES[key] ?? []).find(
      (alias) => !declared.includes(alias) && str(args[alias]),
    );
    if (from) out[key] = args[from];
  }
  return out;
}
