/**
 * The registry, read from disk: registry/companies/<slug>.json and
 * registry/areas/<slug>.json (same pattern as lib/notes.ts). Validated on
 * load; a bad file throws with every broken rule, so a bad PR fails tests
 * and build rather than rendering a wrong page.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { AreaSchema, CompanySchema, validateCompany, type Area, type Company } from './schema';

const ROOT = path.join(process.cwd(), 'registry');

function readAll(dir: string): { file: string; json: unknown }[] {
  const full = path.join(ROOT, dir);
  let names: string[] = [];
  try {
    names = readdirSync(full).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return names
    .sort()
    .map((file) => ({ file, json: JSON.parse(readFileSync(path.join(full, file), 'utf8')) }));
}

export interface Registry {
  companies: Company[];
  areas: Area[];
  bySlug: Map<string, Company>;
  areaBySlug: Map<string, Area>;
}

const today = () => new Date().toISOString().slice(0, 10);

export function parseRegistry(
  companyFiles: { file: string; json: unknown }[],
  areaFiles: { file: string; json: unknown }[],
  now = today(),
): { registry: Registry; problems: string[] } {
  const problems: string[] = [];
  const areas: Area[] = [];
  for (const { file, json } of areaFiles) {
    const r = AreaSchema.safeParse(json);
    if (!r.success)
      problems.push(
        `areas/${file}: ${r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
      );
    else if (`${r.data.slug}.json` !== file)
      problems.push(`areas/${file}: slug ${r.data.slug} does not match the file name`);
    else areas.push(r.data);
  }
  const areaBySlug = new Map(areas.map((a) => [a.slug, a]));
  for (const a of areas) {
    if (a.parent && !areaBySlug.has(a.parent))
      problems.push(`area ${a.slug}: unknown parent ${a.parent}`);
    let depth = 0;
    for (let p = a.parent; p && depth < 6; p = areaBySlug.get(p)?.parent ?? null) depth++;
    if (depth > 3) problems.push(`area ${a.slug}: deeper than three levels`);
  }
  const companies: Company[] = [];
  const slugs = new Set(areaBySlug.keys());
  for (const { file, json } of companyFiles) {
    const r = CompanySchema.safeParse(json);
    if (!r.success) {
      problems.push(
        `companies/${file}: ${r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
      );
      continue;
    }
    if (`${r.data.slug}.json` !== file)
      problems.push(`companies/${file}: slug ${r.data.slug} does not match the file name`);
    problems.push(...validateCompany(r.data, now, slugs));
    companies.push(r.data);
  }
  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  for (const c of companies)
    if (c.parent && !bySlug.has(c.parent))
      problems.push(`${c.slug}: parent ${c.parent} is not in the registry`);
  return { registry: { companies, areas, bySlug, areaBySlug }, problems };
}

let loaded: Registry | null = null;

export function registry(): Registry {
  if (!loaded) {
    const { registry: r, problems } = parseRegistry(readAll('companies'), readAll('areas'));
    if (problems.length)
      throw new Error(`Registry is invalid:\n  ${problems.slice(0, 20).join('\n  ')}`);
    loaded = r;
  }
  return loaded;
}

export const registeredCompanies = () => registry().companies;
export const registeredCompany = (slug: string) => registry().bySlug.get(slug);
