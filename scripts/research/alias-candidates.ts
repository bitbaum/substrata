/**
 * Print the graph nodes that might be one organisation printed two ways, with
 * the evidence for each. Proposes only — nothing is merged until the pair is
 * written into config/entity-aliases.ts with a one-line reason.
 *
 *   pnpm run research:alias-candidates            every proposal
 *   pnpm run research:alias-candidates -- --json  the same, as JSON
 *
 * Matcher: lib/graph/alias-match.ts. Applied pairs: lib/graph/aliases.ts.
 */
import { ENTITY_ALIASES } from '../../config/entity-aliases';
import { aliasCandidates, type MatchNode } from '../../lib/graph/alias-match';
import { graphNode, graphStore } from '../../lib/graph/index';

function nodes(): MatchNode[] {
  const s = graphStore();
  const ids = new Set<string>();
  for (const r of s.all) ids.add(r.from).add(r.to);
  return [...ids]
    .filter((id) => id.startsWith('company:') || id.startsWith('capital:'))
    .map((id) => {
      const n = graphNode(id, s);
      const neighbours = [
        ...(s.from.get(id) ?? []).map((r) => r.to),
        ...(s.to.get(id) ?? []).map((r) => r.from),
      ];
      return { id, name: n.name, iso2: n.iso2, neighbours: [...new Set(neighbours)] };
    });
}

const reviewed = new Set(ENTITY_ALIASES.map((a) => `${a.alias}|${a.canonical}`));
const found = aliasCandidates(nodes(), reviewed);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(found, null, 2));
} else {
  console.log(`Merged by review (config/entity-aliases.ts): ${ENTITY_ALIASES.length}`);
  for (const a of ENTITY_ALIASES) console.log(`  "${a.printed}" → "${a.name}"  ${a.reason}`);
  console.log(`\nProposed, not merged: ${found.length}\n`);
  const name = (id: string) => graphNode(id).name;
  for (const c of found) {
    console.log(`[${c.rule}] "${c.a.name}" (${c.a.id})  ~  "${c.b.name}" (${c.b.id})`);
    console.log(
      `  countries: ${c.a.iso2.join(',') || '—'} / ${c.b.iso2.join(',') || '—'}` +
        `${c.sharedCountries.length ? `  (both: ${c.sharedCountries.join(',')})` : '  (none shared)'}`,
    );
    console.log(
      `  shared counterparties/facilities: ${c.shared.length ? c.shared.map(name).join('; ') : 'none'}\n`,
    );
  }
  console.log(
    'To merge one: add it to config/entity-aliases.ts with the rows that justify it, then run pnpm run research:usgs-relations.',
  );
}
