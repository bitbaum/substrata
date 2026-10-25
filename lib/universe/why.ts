/**
 * `whyCompany(nameOrId)`: for ANY name, why it is or is not in Substrata.
 *
 *   in            tier, themes, and the evidence that admits it
 *   out           exactly which test it fails, and why
 *   considered    looked for on purpose; where we looked and what is missing
 *   named         tier C: a published relation names it, nothing more
 *   queued        never considered — a GapTask is filed so the queue picks it up
 *
 * The answer is computed from the same rows and rule the pages use.
 */
import { CONSIDERED } from '@/config/universe-considered';
import { TESTS, TIERS, themeById } from '@/config/universe-themes';
import { recordDemand } from '@/lib/dossier/demand';
import type { GapTask } from '@/lib/graph/types';
import { slugify } from '@/lib/links';
import { nameKey } from '@/lib/sources/name-key';
import { findUniverseEntry } from './store';
import type { Admission, Considered, TestId, Tier, UniverseEntry } from './types';

export type Membership =
  | {
      status: 'in';
      name: string;
      href: string;
      tier: Tier;
      tierLabel: string;
      themes: string[];
      admittedBy: Admission[];
    }
  | {
      status: 'out';
      name: string;
      href: string;
      failed: { test: TestId; reason: string }[];
      setAside: UniverseEntry['setAside'];
    }
  | { status: 'considered'; name: string; looked: string[]; why: string; on: string }
  | { status: 'named'; name: string; href: string; tier: 'C'; why: string }
  | { status: 'queued'; name: string; why: string; task: GapTask };

/** Where a universe answer is written by a data agent. */
export const UNIVERSE_WRITE_TO =
  'config/candidates/universe.json (facet universe; shape: pnpm exec tsx scripts/research/add.ts universe --schema)';

export const UNIVERSE_SOURCES = [
  'An issuer-published thematic fund holdings file (the row naming it)',
  'SEC EDGAR: company tickers, the filer SIC code, the 10-K cover public float',
  'GLEIF LEI record',
  'Wikidata item (identity and industry class only)',
  "The company's own or a lead investor's statement of a round or valuation",
  'A government programme list or award notice naming it',
];

/** A gap task asking for the evidence on a name nobody has looked at yet. */
export function admissionTask(name: string): GapTask {
  const slug = slugify(name) || 'unnamed';
  return {
    id: `company:${slug}#universe`,
    entity: `company:${slug}`,
    box: 'universe',
    status: 'empty',
    missing: `"${name}" has not been checked against the universe rule: cite its theme, a size figure and a registry identifier, or report which cannot be cited.`,
    allowedSources: UNIVERSE_SOURCES,
    writeTo: UNIVERSE_WRITE_TO,
    demand: 1,
  };
}

function considered(name: string): Considered | undefined {
  const key = nameKey(name);
  if (!key) return undefined;
  // "Figure" asks about "Figure AI": the same words, from the start.
  return CONSIDERED.find((c) => {
    const k = nameKey(c.name);
    return k === key || k.startsWith(`${key} `) || key.startsWith(`${k} `);
  });
}

export interface WhyDeps {
  /** A tier C company (named by a relation) with that name, from the registry. */
  namedOnly?: (name: string) => { name: string; href: string; summary: string } | undefined;
  /** Whether to file demand for a queued name (the Ask does; a test may not). */
  file?: boolean;
  question?: string;
}

export function whyCompany(nameOrId: string, deps: WhyDeps = {}): Membership {
  const name = nameOrId.trim();
  const entry = findUniverseEntry(name);
  if (entry?.admitted)
    return {
      status: 'in',
      name: entry.name,
      href: `/markets/${entry.slug}`,
      tier: entry.tier!,
      tierLabel: TIERS.find((t) => t.tier === entry.tier)!.label,
      themes: entry.themes.map((t) => themeById(t)!.label),
      admittedBy: entry.admittedBy,
    };
  const looked = considered(entry?.name ?? name);
  if (looked) return { status: 'considered', ...looked };
  if (entry)
    return {
      status: 'out',
      name: entry.name,
      href: `/markets/${entry.slug}`,
      failed: entry.failed.map((test) => ({ test, reason: entry.tests[test].reason })),
      setAside: entry.setAside,
    };
  const named = deps.namedOnly?.(name);
  if (named)
    return {
      status: 'named',
      name: named.name,
      href: named.href,
      tier: 'C',
      why: `${named.summary} ${TIERS.find((t) => t.tier === 'C')!.becomes}`,
    };
  const task = admissionTask(name);
  if (deps.file !== false) recordDemand(task.entity, task.box, deps.question ?? name);
  return {
    status: 'queued',
    name,
    why: `Not yet considered: no source has been read for it. The rule needs ${TESTS.map((t) => t.label.toLowerCase()).join(', ')}; a task to find them is queued (${task.id}).`,
    task,
  };
}
