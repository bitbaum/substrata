# lib/graph — the relation graph

Typed, sourced, dated edges between entities. The shapes are in `types.ts`
(`Relation`, `EvidenceGrade`, `RELATION_TYPES`); the design is
`docs/architecture/2026-10-24-research-systems.md` §2–3.

**A relation has a source, a quote and a date, or it does not exist.**
`validate.ts` enforces it on load and throws: `stated` needs one source with a
quote, `corroborated` two different sources, `derived` its `derivedFrom` chain
and `rule` (never resting on a lead), and `lead` is never counted.

## Read API (`import … from '@/lib/graph/index'`)

Import the folder's `index` explicitly: `@/lib/graph` resolves to the older
`lib/graph.ts` adapter, not to this folder.

| Call | Returns |
| --- | --- |
| `relationsFrom(id, { type?, minGrade?, origin? })` | edges leaving `id` (what it operates, owns) |
| `relationsTo(id, …)` | edges arriving at `id` (who operates or owns it) |
| `neighbours(id, …)` | each neighbour as `{ node, relation, direction }` |
| `pathsBetween(a, b, { maxHops = 3, limit = 20, … })` | simple paths, shortest first, either direction |
| `relationEvidence(r)` | what a page prints: sentence, grade label, counted share, every source with quote, locator and reading; a derived relation's rule and chain |
| `graphNode(id)` | a name for any endpoint, including minted ones with no entity |
| `isCounted(r)`, `countedShare(r)` | the only way a number may read a relation: `stated` and `corroborated` only |
| `graphStats()` | counts, conflicts, what the producers skipped |

`minGrade: 'stated'` keeps stated and corroborated. `origin` is `curated`,
`candidate` (not yet promoted) or `research` (parsed by a committed script).
An endpoint not in the directory is a minted `company:<slug>` or
`facility:usgs-<site>`: an id the graph uses and nothing more — no profile.

## Three ways to add an edge

1. **A candidate row.** Write a JSON row and run
   `pnpm exec tsx scripts/research/add.ts relations rows.json --dry-run`
   (`--schema` prints the shape). The quote must appear on the source page;
   the endpoints must already exist on the site or in
   `research/usgs-relations.json`. Rows land in `config/candidates/relations.json`.
2. **A row the corpus already holds.** Ownership holders and facility
   operators are read by `from-corpus.ts`; add the holder or the operator to
   its config file with its source, and the edge follows.
3. **A research file parsed by a script.** `usgs-operators.ts` reads the USGS
   yearbook cells; `scripts/research/build-usgs-relations.ts` writes
   `research/usgs-relations.json` with a report of every string it left
   unparsed and why. Never edit that file by hand: change the parser and
   re-run the script (`test/graph.test.ts` fails when the file is stale).

A hand-written relation with no other home goes in `config/substrata-relations.ts`.
