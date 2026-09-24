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
}
