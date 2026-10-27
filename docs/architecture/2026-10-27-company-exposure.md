# ADR: company exposure — what constrains a company, and what it constrains

Status: accepted, 2026-10-27. Read with `docs/architecture/2026-10-25-company-universe.md`
(which companies are in) and `docs/design/company-page.md` (the page frame). The
model is code: `lib/company-exposure/` (types, derivation, headline), held by
`test/company-exposure.test.ts`.

The owner's complaint, 2026-10-27, on the production NVIDIA page, which led with
"holds 0 of the 33 bottlenecks tracked": "Is NVIDIA not a bottleneck itself? Is it
easy to get NVIDIA chips?" And the bar: the markets product is aimed at institutional
investors and has to be better than paid sell-side semiconductor and industrials
research, and free.

## 0. The diagnosis, confirmed in code

Verified on 2026-10-27.

- A bottleneck is a **thing**: a material, a machine, a place, a queue, a skill
  (`lib/bottlenecks.ts`, 33 rows). A company is attached to it only as a **holder**
  (`produces` rows of `config/substrata-participants.ts`, joined in
  `lib/company-profile.ts` as `held`).
- The lede and the first tile of the page count only that join:
  `app/markets/[slug]/_sections/Lede.tsx` printed "Holds none of the N bottlenecks
  tracked here" when `held` was empty, and `app/markets/[slug]/_sections/AtAGlance.tsx`
  printed "Bottlenecks held 0 of 33 · none of the tracked rows".
- So the page described only **suppliers of constraints**. NVIDIA designs
  accelerators and makes no wafer, no memory stack and no package. Nothing it does is
  a tracked material or machine, so the join was empty, and the empty join was
  printed as a fact about NVIDIA.
- The corpus already knew more than the page said. `config/substrata-dependencies.ts`
  holds NVIDIA's own 10-K sentences naming its foundries (TSMC, Samsung), its memory
  suppliers (SK Hynix, Micron, Samsung) and CoWoS packaging; `lib/profile/modules/dependencies.tsx`
  printed them in a section far below the lede. The headline and the evidence
  contradicted each other on one page.

Both halves of the owner's question are real:

1. NVIDIA is **mostly exposed**: to foundry capacity, to HBM stacking yield and to
   CoWoS packaging, all three scored 10 or 11 of 12 in this site's own assessment.
2. NVIDIA is itself an **allocation-constrained chokepoint** for everyone downstream.
   Its own filing says it has "experienced … extended lead times of more than 12
   months", pays "premiums", gives "deposits" and signs "long-term supply agreements and
   capacity commitments"; CoreWeave's filing says "all of the GPUs used in our
   infrastructure today are NVIDIA GPUs". Whether that is a *bottleneck* by this site's
   test is the owner's decision, and section 5 puts it to him.

## 1. The model

A company has four kinds of edge. Each is directed, typed, graded and cited.

| Edge | Reads | Meaning |
| --- | --- | --- |
| `depends_on` | company → chokepoint (and, through it, the holders) | It cannot make or run what it sells without this. |
| `constrains` | company → organisations and chokepoints | Others wait on what it holds or allocates. The inverse of their `depends_on`. |
| `holds` | company → chokepoint | It controls the node. Today's meaning, unchanged. |
| `substitutes` | chokepoint ← alternative | A second source or another way, with what blocks it. |

`constrains` is **not stored**: it is the inverse of someone else's `depends_on`, read
from the other end. One sentence in a customer's filing therefore improves two pages,
and the two cannot disagree.

### 1.1 Every edge carries

| Field | Rule |
| --- | --- |
| Grade | `stated`, `corroborated`, `derived` or `lead`, the existing set in `lib/graph/types.ts`. Only the first two count. |
| Source | A URL that was actually opened. |
| Quote | The literal sentence from that page. The gate re-reads the page and finds it (`scripts/research/add.ts`). |
| Date | The day it was read, and the date the fact is for. |
| Scope | Where the source is narrower than the edge ("names the foundry, not the node"). |

**No cite, no row.** A derived edge needs no new quote, because its evidence is the
chain: it names the stated rows it follows from, one plain line each. A derived edge
with neither a source nor a chain is a defect, and `test/company-exposure.test.ts`
fails on it.

### 1.2 What `stated` and `derived` mean here

- A company's own sentence says it needs X: `depends_on` X is **stated**.
- Its sentence also names a holder of X (the foundry, the memory maker): that holder
  edge is **stated**. A holder the sentence does not name is **derived**: it holds X, so it is an
  alternative or a second source, and the page says "the filing does not name it".
- A company that holds X, where X needs Y (`config/substrata-dependencies.ts`
  bottleneck rows): its dependence on Y is **derived**, and carries `via X`.
- A company that buys from a supplier a source names, where that supplier holds a
  chokepoint: its dependence on that chokepoint is **derived**.
- Past one step ("it needs a chokepoint that needs a chokepoint it holds"), the page
  lists organisations as leads. They never enter a count.

## 2. What is derived, and what has to be researched

**Derived today, from data already in the repository** (no new claim is made):

| Input | Gives |
| --- | --- |
| `config/substrata-dependencies.ts`, company rows (`needs`, `sells-into`) | The stated `depends_on` edges and, read from the other end, who waits on a holder. |
| The same file, bottleneck rows | What a chokepoint rests on: the inputs of what a company holds. |
| `produces` rows of the directory, `lib/bottlenecks.ts` producers | `holds`, and the other makers of any chokepoint (the second sources). |
| `config/substrata-substitutes.ts` | `substitutes`: the alternative, its status, what blocks it. Only helium and gallium have rows today. |
| The assessment (`config/substrata-assessment.ts`) | How binding each chokepoint is, and the two tests that answer "how hard to replace" and "how long to build": substitution and lead time. |
| The relation graph (`lib/graph/index.ts`): counted `buys_from` and `supplies` edges between companies | Named suppliers and customers. |

**Not derivable, and researched row by row** through the existing data-entry contract
(`scripts/research/add.ts relations`, `prompts/data-entry.md`):

- Company-to-company supply edges (who buys from whom): the graph held none for
  semiconductors; every company edge in it was ownership, operation or a country.
- Customers that say they depend on a named supplier (the `constrains` side of a
  company that holds no node, such as NVIDIA).
- Lead times, qualification times and capacity commitments **as stated figures**
  (for example NVIDIA's "$95.2 billion" of purchase and capacity obligations). Not stored yet:
  see section 6.
- Alternatives and how long they take to qualify: a sourced row per alternative.

Anything that is none of these is a gap, shown as a gap (section 4).

`research/derived-relations.json` and `research/usgs-relations.json` are untouched. Their
rule-made leads are not walked and not counted, and this model does not read them.

## 3. How it is scored

There is **no composite company score** in this slice, on purpose. A weight needs a
stated share or volume ("the foundry makes 70% of our wafers") and the corpus has none.
A score built on none would be a number with nobody behind it.

What there is, in order:

1. **Rank of a dependence** = the chokepoint's binding score (the assessment's sum of
   four 0–3 tests, of 12, judged by this project and dated), then nearer horizon first,
   then `stated` before `derived`, then name. The same order everywhere
   (`byBinding` in `lib/company-exposure/refs.ts`).
2. **Single source**: `soleRecorded` when one maker is recorded. "Recorded" is the whole claim.
3. **Alternatives**: the written rows, or the statement that none is written. "None
   written" is never printed as "none exist".
4. **Counts** in the headline: chokepoints it is exposed to, organisations on record as
   waiting on it, chokepoints it holds.

The counts are counts of rows, the way the rest of the corpus counts them.

## 4. How it is shown

The page answers four questions for **every** company, in this order, with one anatomy
per row (the other party, the relation, the grade, the date, the source):

1. **What constrains it**: chokepoints it rests on, hardest binding first; for each,
   who holds it (the ones its own sentence names first), whether one maker is all
   there is, the alternatives and what blocks them, what the chokepoint itself rests on.
2. **What it constrains**: organisations that wait on what it holds or allocates, and
   chokepoints that need it; one step further as leads.
3. **What it holds outright**: today's section, unchanged.
4. **Alternatives**: inside (1), per chokepoint.

The lede never opens on "holds 0 of N". `headline()` in `lib/company-exposure/headline.ts`:

- holds something: "Holds 1 bottleneck outright; exposed to 5 of the 33 …; a constraint on 8
  organisations on record."
- holds nothing, has edges: "Exposed to 3 of the 33 bottlenecks tracked here; a constraint on 1
  organisation on record."
- nothing recorded: "No exposure is recorded for X yet. That is a gap in the sources read,
  not a finding that it has none." and, on each empty side, the dossier's own task for
  the `suppliers` or `customers` box, with the documents that would fill it.

A side that is **thin** is also a task: fewer than three named counterparties is the
dossier's own threshold for "thin" (`lib/dossier/boxes/company.ts`).

## 5. What it means for the bottleneck list

Checked against the 33 on 2026-10-27. **Already tracked**, so not proposed again:
advanced packaging capacity (CoWoS), leading-edge foundry capacity, HBM stacking yield, large
power transformer slots, heavy-duty gas turbine order books, grain-oriented electrical
steel, high-voltage cable and switchgear, uranium conversion and enrichment, grid
interconnection queues, EUV scanners and optics, photoresist, 300 mm wafers, neon, helium.

**Proposed, not added.** Adding a bottleneck is the owner's decision, because it is a
judgement (four scored tests) and it moves every score that reads the list.

| Candidate | The argument | What is on file |
| --- | --- | --- |
| **AI accelerators, allocation** (merchant GPUs and custom accelerators) | The owner's question. A hyperscaler's 10-K names "graphics processing units" among what its datacenters depend on, without naming a supplier; a GPU cloud's 10-K says all its GPUs are NVIDIA's by contract; NVIDIA's own says lead times above 12 months and prepaid capacity. Concentration, substitution (custom silicon takes a design cycle plus the same foundry, memory and packaging) and lead time all score. The honest caveat: it is allocation, a commercial decision, not a physical limit, and it sits on top of three tracked nodes. | NVIDIA, CoreWeave and Microsoft filings, opened 2026-10-27. Enough to argue; **not scored**. |
| Package substrates (build-up film and the substrates made from it) | Advanced packaging needs more than CoWoS capacity: a substrate and its film. Said to have been the binding input in the 2021–23 shortage. | **No source opened.** A task, not a claim. |
| High-assay low-enriched uranium (HALEU) | Oklo and most advanced reactor designs need it; the enrichment node tracked today is the low-assay one. | **No source opened.** |
| Indium phosphide lasers for optical interconnect | Cluster interconnect moves to optics; a few makers. | **No source opened.** |
| Skilled electrical trades for datacenter and substation build | The talent stage has one row (process engineers). | **No source opened.** |

The first is the one that changes how companies read: with it, NVIDIA **holds** a
chokepoint and its page has a `constrains` side backed by more than one named customer. Until the
owner says yes, the page does the honest thing with what exists: NVIDIA is "exposed to 3",
its named customers come from the relation graph, and the missing ones are a task.

## 6. What this slice does not do

- It does not score a company, weight an edge, or compute a share of revenue.
- It does not store lead times, commitments or allocation language as fields. The
  next edge attribute is a stated figure with its own quote (for example purchase and
  capacity obligations, lead time in months), never an estimate.
- It does not read channel checks, private contracts or paywalled data. That is where paid
  research has an edge this project cannot match; the answer is not to pretend. What
  this offers instead: every edge opens its sentence, derived is never dressed as stated,
  and the gaps are public and become tasks anyone can fill.
- It does not cover the 1,186 stub companies beyond the sentences that name them.
- Tier B companies (identified, not profiled) get edges only where a cited sentence
  creates one. Oklo has none yet, and its page says what is unknown.

## 7. Adding an edge

1. A company's own sentence says it needs a chokepoint: a row in
   `config/substrata-dependencies.ts` (company, chokepoint, source, verbatim quote, scope).
2. A company's sentence names a supplier or customer: a `relations` candidate, `buys_from`
   or `supplies`, through `scripts/research/add.ts relations`. The gate refuses a quote
   it cannot find on the page and a page it cannot read (it refuses files over 16 MB:
   ASML's 20-F is one, so its sentence naming its sole optics supplier waits for a
   second source).
3. An alternative: a row in `config/substrata-substitutes.ts` with what blocks it.

Nothing else writes to the model.
