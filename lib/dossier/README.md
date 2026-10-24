# lib/dossier — the dossier standard and the work queue

Design: `docs/architecture/2026-10-24-research-systems.md`, sections 5 and 6.

Every country, company, resource and lab is filled against the same fixed
boxes, so nothing is missed and no model reinvents the process. A box is
`full`, `thin` or `empty` by a written rule over the rows that exist. Nobody
sets it.

| file | what it holds |
| --- | --- |
| `definitions.ts` | the types, `boxStatus` (the one rule), `DOSSIER_DEFINITIONS`, `PRIORITY_COUNTRIES` |
| `boxes/<kind>.ts` | each box: question, thresholds (named constants, each with its reason), allowed sources best first, where answers are written, one worked example |
| `counters/<kind>.ts` | how each box counts rows from config, `research/*.json` and the candidate files |
| `compute.ts` | `computeDossier(id)`: every box of a subject with status, counts and the missing sentence |
| `tasks.ts` | `emitTasks()`: one `GapTask` per empty or thin box, with a prompt-ready `instruction` |
| `demand.ts` | `recordDemand(entity, box, question)`: the seam the Ask files unanswered questions through |
| `relations.ts` | `RelationCounter`: the seam the relation graph plugs into |

## The rule

Only `stated` and `corroborated` rows count (`COUNTED_GRADES` in
`lib/graph/types.ts`). A curated row with no grade reads `stated`; a candidate
row (`config/candidates/*.json`) reads `lead`. A box is full when its counted
rows reach `thresholds.full`, its core row is present (when it has one, e.g. a
licensing law, a controlling stake), and the rows the data itself expects are
all there (e.g. every resource the directory names for a country is measured).
Otherwise it is thin with at least one counted row, else empty. Leads and
derived rows are shown beside the count and never move a box.

## Subjects

`country:<iso2>`, `company:<slug>`, `resource:<id>` (no entity kind yet, hence
`SubjectId` in `lib/graph/types.ts`) and `science:<id>`, which carries the lab
dossier until labs and people are an entity kind.

## The queue

```bash
pnpm exec tsx scripts/research/gaps.ts --limit 10
pnpm exec tsx scripts/research/gaps.ts --entity country:kz --box facilities --out task.json
```

Ordered by demand, then the owner's country list, unblocked before blocked,
then kind, empty before thin. A task whose answer has no candidate path yet
(a missing facet, a jurisdiction the register lacks, a box a person fills)
carries `blockedBy` instead of hiding. `prompts/data-entry.md` says what a
model does with one; `scripts/research/add.ts` stays the only gate.

## Seams for other systems

- **Relations**: implement `RelationCounter.count(subject, { types, direction })`
  over the graph store and pass it as `{ relations }` to `computeDossier` or
  `emitTasks`. Boxes declare their relation types in `relations`.
- **Demand**: implement `DemandLedger` over a store and install it with
  `useDemandLedger`; the Ask calls `recordDemand` when an answer ends at a gap.

Shown on `/data/quality` (priority countries) and on every `/world/<iso2>`
page ("What we know, and what is missing").
