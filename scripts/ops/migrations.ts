/**
 * Migration planner and applier for scripts/db/NNN-*.sql.
 *
 * Rules, in the order they matter:
 *   - Applied files are recorded by filename in public.schema_migrations.
 *   - Each pending file runs in ONE transaction together with its ledger row, as the
 *     app's own role (so the app owns what it creates). Any failure rolls back and
 *     aborts; the caller must stop the deploy.
 *   - A database that has no ledger yet may already hold some of these files (001 was
 *     applied by provision-service.py, others by hand). On that first run a file is
 *     recorded WITHOUT running only when every table, index and column it declares
 *     exists; anything else is run, which is safe because every file here is
 *     idempotent (test/data-layer.test.ts enforces that). The plan names what is missing.
 *   - Dry-run reads, plans and prints; it creates and changes nothing.
 */
import type { SqlRunner } from './box';

export const MIGRATION_FILE = /^\d{3}-[a-z0-9-]+\.sql$/;
const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (value: string): string => {
  if (!IDENT.test(value)) throw new Error(`not a plain identifier: ${value}`);
  return value;
};
const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

export const migrationNames = (all: string[]): string[] =>
  all.filter((name) => MIGRATION_FILE.test(name)).sort();

export interface Declared {
  tables: string[];
  indexes: string[];
  columns: [table: string, column: string][];
}

/** SQL with comments and string literals blanked, so words inside them declare nothing. */
export function stripNoise(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''");
}

/** What a file promises to leave behind, as far as it can be read without a SQL parser. */
export function declaredObjects(sql: string): Declared {
  const text = stripNoise(sql);
  const tables = [
    ...text.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/gi),
  ];
  const indexes = [
    ...text.matchAll(
      /\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(\w+)/gi,
    ),
  ];
  const columns: [string, string][] = [];
  for (const alter of text.matchAll(
    /\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?(\w+)([^;]*)/gi,
  )) {
    for (const add of alter[2].matchAll(/\badd\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi)) {
      columns.push([alter[1].toLowerCase(), add[1].toLowerCase()]);
    }
  }
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()))];
  return {
    tables: uniq(tables.map((m) => m[1])),
    indexes: uniq(indexes.map((m) => m[1])),
    columns,
  };
}

/** The file inside this tool's own transaction: standalone BEGIN/COMMIT lines are dropped. */
export function wrapMigration(name: string, sql: string, role: string): string {
  const body = sql.replace(/^\s*(?:begin|commit|start\s+transaction)\s*;\s*$/gim, '');
  return [
    'BEGIN;',
    `SET LOCAL ROLE ${ident(role)};`,
    "SET LOCAL lock_timeout = '15s';",
    "SELECT pg_advisory_xact_lock(hashtext('substrata-schema-migrations'));",
    body,
    `INSERT INTO public.schema_migrations(filename, how) VALUES (${quote(name)}, 'applied') ON CONFLICT DO NOTHING;`,
    'COMMIT;',
    '',
  ].join('\n');
}

export const ledgerSql = (role: string): string => `SET ROLE ${ident(role)};
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  how text NOT NULL DEFAULT 'applied' CHECK (how IN ('applied', 'baseline'))
);
CREATE TABLE IF NOT EXISTS public.schema_oneshots (
  name text PRIMARY KEY,
  finished_at timestamptz NOT NULL DEFAULT now(),
  note text
);
`;

export interface Step {
  name: string;
  action: 'skip' | 'baseline' | 'apply';
  /** First run only: objects the file declares that the database does not have. */
  missing: string[];
}
export interface Plan {
  ledgerExists: boolean;
  steps: Step[];
  /** Tables these files create that the app role does not own (hand-applied as postgres). */
  misowned: string[];
}
export interface MigrationFile {
  name: string;
  sql: string;
}

async function missingObjects(run: SqlRunner, d: Declared): Promise<string[]> {
  const parts: string[] = [];
  const list = (xs: string[]) => `ARRAY[${xs.map((x) => quote(ident(x))).join(',')}]::text[]`;
  if (d.tables.length)
    parts.push(
      `SELECT 'table ' || n FROM unnest(${list(d.tables)}) n WHERE to_regclass('public.' || n) IS NULL`,
    );
  if (d.indexes.length)
    parts.push(
      `SELECT 'index ' || n FROM unnest(${list(d.indexes)}) n WHERE to_regclass('public.' || n) IS NULL`,
    );
  if (d.columns.length)
    parts.push(
      `SELECT 'column ' || t || '.' || c FROM (VALUES ${d.columns
        .map(([t, c]) => `(${quote(ident(t))},${quote(ident(c))})`)
        .join(',')}) v(t, c) WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t AND column_name = c)`,
    );
  if (!parts.length) return [];
  const out = await run(parts.join('\nUNION ALL\n') + ';');
  return out ? out.split('\n') : [];
}

export async function planMigrations(
  run: SqlRunner,
  files: MigrationFile[],
  role = 'substrata',
): Promise<Plan> {
  const ledgerExists =
    (await run("SELECT to_regclass('public.schema_migrations') IS NOT NULL;")) === 't';
  let applied = new Set<string>();
  if (ledgerExists) {
    const [count, ...names] = (
      await run(
        `SELECT count(*) FROM public.schema_migrations;\nSELECT filename FROM public.schema_migrations;`,
      )
    ).split('\n');
    // A list cut short would make an old migration look pending and run it again.
    if (names.filter(Boolean).length !== Number(count)) {
      throw new Error('ledger read was incomplete; refusing to plan from it');
    }
    applied = new Set(names.filter(Boolean));
  }
  const firstRun = applied.size === 0;
  const steps: Step[] = [];
  for (const file of files) {
    if (applied.has(file.name)) {
      steps.push({ name: file.name, action: 'skip', missing: [] });
      continue;
    }
    if (!firstRun) {
      steps.push({ name: file.name, action: 'apply', missing: [] });
      continue;
    }
    const declared = declaredObjects(file.sql);
    const total = declared.tables.length + declared.indexes.length + declared.columns.length;
    const missing = total ? await missingObjects(run, declared) : ['declares no objects to check'];
    steps.push({ name: file.name, action: missing.length ? 'apply' : 'baseline', missing });
  }
  return { ledgerExists, steps, misowned: await misownedTables(run, files, role) };
}

/**
 * A file applied by hand as the superuser leaves tables the app role cannot COMMENT on
 * or ALTER, so a later re-run would die with "must be owner". They are the app's own
 * tables (named in its own migrations), so the apply step hands them to the app role.
 */
async function misownedTables(run: SqlRunner, files: MigrationFile[], role: string) {
  const tables = [...new Set(files.flatMap((f) => declaredObjects(f.sql).tables))];
  if (!tables.length) return [];
  const list = tables.map((t) => quote(ident(t))).join(',');
  const out = await run(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (${list}) AND tableowner <> ${quote(ident(role))} ORDER BY 1;`,
  );
  return out ? out.split('\n') : [];
}

export function describePlan(plan: Plan): string[] {
  const lines = [
    plan.ledgerExists
      ? 'ledger public.schema_migrations present'
      : 'ledger public.schema_migrations absent: first run, existing objects are checked before anything is recorded',
  ];
  if (plan.misowned.length) {
    lines.push(`  owner fix: ${plan.misowned.join(', ')} will be handed to the app role`);
  }
  for (const s of plan.steps) {
    const why = s.missing.length ? ` (missing: ${s.missing.join(', ')})` : '';
    const verb = { skip: 'recorded ', baseline: 'baseline ', apply: 'apply    ' }[s.action];
    lines.push(
      `  ${verb} ${s.name}${s.action === 'baseline' ? ' (every declared object exists)' : why}`,
    );
  }
  return lines;
}

/** Applies the plan. Throws on the first failure, naming the file; nothing later runs. */
export async function applyMigrations(
  run: SqlRunner,
  plan: Plan,
  files: MigrationFile[],
  role: string,
  log: (line: string) => void,
): Promise<void> {
  await run(ledgerSql(role));
  for (const table of plan.misowned) {
    await run(`ALTER TABLE public.${ident(table)} OWNER TO ${ident(role)};`);
    log(`owner fix: public.${table} now belongs to ${role}`);
  }
  for (const step of plan.steps) {
    if (step.action === 'skip') continue;
    const file = files.find((f) => f.name === step.name)!;
    if (step.action === 'baseline') {
      await run(
        `INSERT INTO public.schema_migrations(filename, how) VALUES (${quote(step.name)}, 'baseline') ON CONFLICT DO NOTHING;`,
      );
      log(`baseline ${step.name}: recorded, not run`);
      continue;
    }
    try {
      await run(wrapMigration(step.name, file.sql, role));
    } catch (error) {
      const why = error instanceof Error ? error.message : 'unknown';
      throw new Error(`migration ${step.name} failed and was rolled back: ${why}`);
    }
    log(`applied ${step.name} and recorded it in one transaction`);
  }
}
