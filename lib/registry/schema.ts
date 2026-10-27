/**
 * The frontier registry's shapes (docs/architecture/2026-10-28-frontier-registry.md).
 * One JSON file per company in registry/companies and one per area in
 * registry/areas. A value is present only if an evidence row names its field:
 * no cite, no value. `validateCompany` returns every rule it finds broken.
 */
import { z } from 'zod';

import { THEME_IDS } from '@/config/universe-themes';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const KINDS = [
  'public',
  'private',
  'lab',
  'subsidiary',
  'state-owned',
  'consortium',
  'university-lab',
  'non-profit',
  'unclassified',
] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  public: 'Listed company',
  private: 'Private company',
  lab: 'Frontier lab',
  subsidiary: 'Subsidiary',
  'state-owned': 'State-owned',
  consortium: 'Consortium',
  'university-lab': 'University lab',
  'non-profit': 'Non-profit',
  unclassified: 'Not yet classified',
};

export const STATUSES = ['active', 'acquired', 'defunct', 'merged', 'dormant'] as const;
export type Status = (typeof STATUSES)[number];

/** stated: it or a primary document says so. reported: a named publisher, quoted.
 * registry: a structured record (Wikidata, GLEIF, EDGAR). estimated: a named third party's estimate. */
export const GRADES = ['stated', 'reported', 'registry', 'estimated'] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_LABEL: Record<Grade, string> = {
  stated: 'Stated',
  reported: 'Reported',
  registry: 'Registry record',
  estimated: 'Estimated by a third party',
};

const date = z.string().regex(ISO_DATE, 'a YYYY-MM-DD date');
/** Empty only on a migrated row the old filter dated no more precisely than its source. */
const maybeDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'a YYYY-MM-DD date');

export const EvidenceSchema = z
  .object({
    /** The field this row backs: summary, kind, country, hq, parent, status, ids.<k>, area:<slug>, figure:<id>. */
    field: z.string().min(2),
    grade: z.enum(GRADES),
    source: z.string().regex(/^https?:\/\/\S+$/, 'a web address that was opened'),
    /** Literal text from the source (a structured record: the statement as rendered). */
    quote: z.string().min(20).max(500).optional(),
    readOn: maybeDate,
    asOf: maybeDate,
    /** A migrated row from the old universe filter that carried no quote. Never valid on a new row. */
    carried: z.boolean().optional(),
    /** The old filter's words, kept on a migrated row: test, theme, basis, detail, usd. */
    test: z.enum(['theme', 'materiality', 'identity']).optional(),
    theme: z.enum(THEME_IDS).optional(),
    basis: z.string().optional(),
    detail: z.string().optional(),
    usd: z.number().positive().optional(),
  })
  .strict();
export type Evidence = z.infer<typeof EvidenceSchema>;

export const IdsSchema = z
  .object({
    ticker: z.string().min(1).optional(),
    exchange: z.string().min(1).optional(),
    isin: z.string().length(12).optional(),
    cusip: z.string().min(6).max(9).optional(),
    sedol: z.string().length(7).optional(),
    cik: z.string().min(1).optional(),
    lei: z.string().length(20).optional(),
    qid: z
      .string()
      .regex(/^Q\d+$/)
      .optional(),
    domain: z.string().min(3).optional(),
    registry: z.string().min(1).optional(),
  })
  .strict();
export type Ids = z.infer<typeof IdsSchema>;

export const AreaRefSchema = z
  .object({ area: z.string().regex(SLUG), role: z.string().min(5).max(200).optional() })
  .strict();

/** A private-company number. The label (stated / reported / estimated) comes from its evidence row. */
export const FigureSchema = z
  .object({
    id: z.string().regex(SLUG),
    what: z.enum(['round', 'valuation', 'headcount', 'compute', 'revenue', 'other']),
    label: z.string().min(3).max(160),
    amount: z.string().min(1).max(80),
    /** The date the figure is true for. */
    on: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/),
  })
  .strict();

export const CompanySchema = z
  .object({
    slug: z.string().regex(SLUG),
    name: z.string().min(2),
    aliases: z.array(z.string().min(1)).default([]),
    kind: z.enum(KINDS),
    status: z.enum(STATUSES).default('active'),
    statusNote: z.string().optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    hq: z.string().min(2).optional(),
    jurisdictions: z.array(z.string().regex(/^[A-Z]{2}$/)).default([]),
    ids: IdsSchema.default({}),
    parent: z.string().regex(SLUG).optional(),
    areas: z.array(AreaRefSchema).default([]),
    summary: z.string().min(20).max(400).optional(),
    figures: z.array(FigureSchema).default([]),
    evidence: z.array(EvidenceSchema).default([]),
    origin: z.object({ by: z.string().min(2), on: date, proposer: z.string().optional() }).strict(),
  })
  .strict();
export type Company = z.infer<typeof CompanySchema>;

export const AreaSchema = z
  .object({
    slug: z.string().regex(SLUG),
    name: z.string().min(2),
    parent: z.string().regex(SLUG).nullable(),
    theme: z.enum(THEME_IDS),
    definition: z.string().min(30),
    why: z.string().min(30),
    bottlenecks: z.array(z.string().regex(SLUG)).default([]),
    keyNumbers: z
      .array(
        z
          .object({
            label: z.string().min(3),
            value: z.string().min(1),
            evidence: EvidenceSchema,
          })
          .strict(),
      )
      .default([]),
  })
  .strict();
export type Area = z.infer<typeof AreaSchema>;

/** Identifier kinds that need their own evidence row; the rest ride on any ids.* row. */
const ID_CLAIMS = new Set(['ticker', 'cik', 'lei', 'qid', 'domain', 'registry']);

/** Fields of a company that must be backed by an evidence row when present. */
export function claimedFields(c: Company): string[] {
  const out: string[] = [];
  if (c.summary) out.push('summary');
  if (c.country) out.push('country');
  if (c.hq) out.push('hq');
  if (c.parent) out.push('parent');
  if (c.status !== 'active') out.push('status');
  for (const [k, v] of Object.entries(c.ids)) if (v && ID_CLAIMS.has(k)) out.push(`ids.${k}`);
  for (const f of c.figures) out.push(`figure:${f.id}`);
  return out;
}

/** Every broken rule, in words. Empty means the file is valid. `today` guards future dates. */
export function validateCompany(
  c: Company,
  today: string,
  areaSlugs: ReadonlySet<string>,
): string[] {
  const bad: string[] = [];
  const have = new Set(c.evidence.map((e) => e.field));
  for (const f of claimedFields(c))
    if (!have.has(f)) bad.push(`${c.slug}: ${f} has no evidence row`);
  for (const e of c.evidence) {
    if (!e.quote && !e.carried) bad.push(`${c.slug}: evidence for ${e.field} has no quote`);
    if (e.carried && c.origin.by !== 'migration')
      bad.push(`${c.slug}: only a migrated row may be carried (${e.field})`);
    if (!e.carried && (!e.readOn || !e.asOf))
      bad.push(`${c.slug}: evidence for ${e.field} has no dates`);
    if (e.readOn > today || e.asOf > today) bad.push(`${c.slug}: ${e.field} is dated after today`);
  }
  for (const a of c.areas)
    if (!areaSlugs.has(a.area)) bad.push(`${c.slug}: unknown area ${a.area}`);
  if (Object.values(c.ids).some(Boolean) && !c.evidence.some((e) => e.field.startsWith('ids.')))
    bad.push(`${c.slug}: identifiers with no ids.* evidence row`);
  if (c.kind === 'public' && !(c.ids.ticker && c.ids.exchange))
    bad.push(`${c.slug}: a listed company needs a ticker and exchange`);
  if (c.parent === c.slug) bad.push(`${c.slug}: is its own parent`);
  return bad;
}
