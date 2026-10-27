/**
 * Add companies to the registry. One command, one new file.
 *
 *   pnpm run company:add -- "Physical Intelligence" --areas robot-foundation-models --kind private
 *   pnpm run company:add -- https://en.wikipedia.org/wiki/Figure_AI --areas humanoids
 *   pnpm run company:add -- https://www.figure.ai --areas humanoids
 *   pnpm run company:add -- --batch seed.json          [{name,title?,kind,areas[],aliases?}, ...]
 *
 * Resolves identity from Wikipedia (what it is) and Wikidata (QID, HQ,
 * country, ticker, CIK, LEI, website), writes registry/companies/<slug>.json
 * with evidence only for what it fetched, validates it, and prints the gaps
 * (what the page will say it does not know yet). It never guesses between
 * two candidates and never overwrites a file.
 * Decided: docs/architecture/2026-10-28-frontier-registry.md §5.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { nameKey } from '../../lib/sources/name-key';
import { draftCompany } from '../../lib/registry/draft';
import { gapsOf } from '../../lib/registry/gaps';
import { parseRegistry } from '../../lib/registry/load';
import {
  httpFetch,
  resolveTitle,
  domainOf,
  USER_AGENT,
  type Fetcher,
} from '../../lib/registry/resolve';
import { KINDS, type Company, type Kind } from '../../lib/registry/schema';

const ROOT = process.cwd();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polite fetch: one at a time, backs off on 429. */
const polite: Fetcher = async (url) => {
  for (let i = 0; i < 5; i++) {
    const res = await httpFetch(url);
    if (res.status !== 429) {
      await sleep(700);
      return res;
    }
    await sleep(3000 * (i + 1));
  }
  return httpFetch(url);
};

interface Item {
  name: string;
  title?: string;
  kind?: Kind;
  areas: string[];
  aliases?: string[];
  slug?: string;
}

function readJson(dir: string, file: string) {
  return JSON.parse(readFileSync(path.join(ROOT, 'registry', dir, file), 'utf8'));
}

/** The slug of a registered company that is the same entity: same Wikidata item, else same name or alias. */
let index: { qid: Map<string, string>; name: Map<string, string> } | null = null;
function existingFor(c: Company, qid: string | undefined): string | undefined {
  if (!index) {
    index = { qid: new Map(), name: new Map() };
    const dir = path.join(ROOT, 'registry', 'companies');
    for (const f of readdirSync(dir)) {
      const x = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Company;
      if (x.ids.qid) index.qid.set(x.ids.qid, x.slug);
      for (const n of [x.name, ...x.aliases]) index.name.set(nameKey(n), x.slug);
    }
  }
  const hit = (qid && index.qid.get(qid)) || index.name.get(nameKey(c.name));
  if (!hit) {
    index.qid.set(qid ?? '', c.slug);
    index.name.set(nameKey(c.name), c.slug);
  }
  return hit;
}

async function searchTitles(q: string): Promise<string[]> {
  const res = await polite(
    `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=5`,
  );
  if (!res.ok) return [];
  const j = (await res.json()) as { pages?: { title: string }[] };
  return (j.pages ?? []).map((p) => p.title);
}

/** Pick the title for a name, a Wikipedia URL, or a company site; null when it is not unambiguous. */
async function pickTitle(
  arg: string,
  hint?: string,
): Promise<{ title: string | null; why: string }> {
  if (hint) return { title: hint, why: 'given' };
  const wiki = arg.match(/^https?:\/\/en\.wikipedia\.org\/wiki\/([^#?]+)/);
  if (wiki) return { title: decodeURIComponent(wiki[1]).replace(/_/g, ' '), why: 'wikipedia url' };
  if (/^https?:\/\//.test(arg)) {
    const host = domainOf(arg)!;
    const term = host.split('.').slice(-2, -1)[0];
    for (const t of await searchTitles(term)) {
      const r = await resolveTitle(t, '1970-01-01', polite);
      if (r?.record?.website && domainOf(r.record.website) === host)
        return { title: t, why: `Wikidata website matches ${host}` };
    }
    return { title: null, why: `no Wikidata item has website ${host}; add --title` };
  }
  const found = await searchTitles(arg);
  const exact = found.filter((t) => nameKey(t.replace(/\s*\(.*\)$/, '')) === nameKey(arg));
  if (exact.length === 1) return { title: exact[0], why: 'exact name match' };
  return {
    title: null,
    why: `ambiguous or unknown; candidates: ${found.join(' | ') || 'none'}; use --title`,
  };
}

export async function addOne(item: Item, today: string): Promise<string> {
  const { title, why } = await pickTitle(item.name, item.title);
  if (!title) return `SKIP ${item.name}: ${why}`;
  const r = await resolveTitle(title, today, polite);
  if (!r) return `SKIP ${item.name}: no page ${title}`;
  const nameWords = nameKey(item.name).split(' ');
  const says = nameKey(`${r.page.title} ${r.page.extract}`);
  if (!nameWords.some((w) => w.length > 2 && says.includes(w)) && !item.title)
    return `SKIP ${item.name}: page "${r.page.title}" does not mention it`;
  const c = draftCompany(r, {
    name: item.name,
    slug: item.slug,
    kind: item.kind,
    aliases: item.aliases,
    areas: item.areas.map((area) => ({ area })),
    today,
  });
  const known = existingFor(c, r.ids.qid);
  const file = path.join(ROOT, 'registry', 'companies', `${known ?? c.slug}.json`);
  if (known || existsSync(file)) return enrich(file, c);
  const areaFiles = (await import('node:fs'))
    .readdirSync(path.join(ROOT, 'registry', 'areas'))
    .map((f) => ({ file: f, json: readJson('areas', f) }));
  const { problems } = parseRegistry([{ file: `${c.slug}.json`, json: c }], areaFiles, today);
  const own = problems.filter((p) => !/not in the registry/.test(p));
  if (own.length) return `SKIP ${c.slug}: ${own.join('; ')}`;
  writeFileSync(file, JSON.stringify(c, null, 2) + '\n');
  const gaps = gapsOf(c)
    .map((g) => g.field)
    .join(', ');
  return `ADD  ${c.slug} (${c.kind}${c.country ? ', ' + c.country : ''}) via ${why}; page "${r.page.title}" (${r.page.description ?? 'no description'}); gaps: ${gaps || 'none'}`;
}

/** A registered company gains the fields it lacks; nothing it already says is changed. */
function enrich(file: string, fresh: Company): string {
  const have = JSON.parse(readFileSync(file, 'utf8')) as Company;
  const seen = new Set(have.evidence.map((e) => e.field));
  const rows = fresh.evidence.filter((e) => !seen.has(e.field));
  if (!rows.length && !(have.kind === 'unclassified' && fresh.kind !== 'unclassified'))
    return `SKIP ${have.slug}: already registered, nothing to add`;
  const added = new Set(rows.map((e) => e.field));
  const next: Company = {
    ...have,
    ...(!have.summary && added.has('summary') && fresh.summary ? { summary: fresh.summary } : {}),
    ...(!have.hq && added.has('hq') && fresh.hq ? { hq: fresh.hq } : {}),
    ...(!have.country && added.has('country') && fresh.country ? { country: fresh.country } : {}),
    kind: have.kind === 'unclassified' ? fresh.kind : have.kind,
    ids: { ...fresh.ids, ...have.ids },
    areas: have.areas.length ? have.areas : fresh.areas,
    evidence: [
      ...have.evidence,
      ...rows.filter((e) => !e.field.startsWith('ids.') || !(e.field.slice(4) in have.ids)),
    ],
  };
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  return `ENRICH ${have.slug}: added ${[...added].join(', ') || 'kind'}`;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const today = new Date().toISOString().slice(0, 10);
  const batch = flag('batch');
  if (batch) {
    const items = JSON.parse(readFileSync(batch, 'utf8')) as Item[];
    for (const item of items) console.log(await addOne(item, today));
    return;
  }
  const name = argv.find(
    (a) =>
      !a.startsWith('--') &&
      a !== flag('areas') &&
      a !== flag('kind') &&
      a !== flag('title') &&
      a !== flag('slug'),
  );
  const areas = flag('areas')?.split(',').filter(Boolean) ?? [];
  const kind = flag('kind') as Kind | undefined;
  if (!name || (kind && !KINDS.includes(kind))) {
    console.error(
      'usage: company:add -- "<name or url>" [--areas a,b] [--kind lab|private|public|…] [--title "Wikipedia title"] [--slug s]',
    );
    process.exit(1);
  }
  console.log(await addOne({ name, title: flag('title'), kind, areas, slug: flag('slug') }, today));
  console.error(`(user agent: ${USER_AGENT})`);
}

if (process.argv[1]?.endsWith('add.ts')) void main();
