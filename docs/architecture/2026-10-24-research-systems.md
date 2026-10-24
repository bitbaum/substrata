# Research systems — the skeleton before the data

Decided 2026-10-24 (owner: "first the skeleton, first the systems … then we add the data
the way it makes sense, so we don't do double work"). This extends
[the knowledge-system ADR](./2026-10-23-knowledge-system.md); read that first for the
index, significance and the candidate-row contract. Nothing here weakens one rule of it:
**a row has a source, a quote and a date, or it is not a row.**

## Why this exists: what a live question showed

Asked on the live site on 2026-10-24, "Which companies mine uranium in Kazakhstan, who
owns them, and who do they sell to?", the Ask answered with one production figure and
then: "the mining entities, ownership details, and buyer relationships … are not recorded
in the corpus."

That was false twice over. `research/usgs-producers.json` holds 35 Kazakh facility rows
with the operating company, and many of those strings carry the owner and its share in
brackets (`Aluminium of Kazakhstan JSC [Eurasian Resources Group (ERG), 100% (private,
60%, and Government, 40%)]`). No tool read them. And the web was never tried. The wall was
not missing data; it was missing plumbing. So the systems come first.

## 1. The answer ladder: there is no wall

An answer is built by climbing, and it stops climbing only when it has a sentence worth
reading. In order:

1. **Corpus facts.** Curated rows (`config/`), then candidate rows, through `retrieve()`.
2. **Research files.** `research/*.json` read by typed tools, not only by the pages:
   `producers_in(country, resource)` (USGS facility rows with operator, owner string,
   location, capacity, year), `restrictions_on(resource, country)`, `sanctions_on(entity)`.
3. **The graph.** Walk typed relations (section 3): from a country to its facilities, to
   their operators, to their owners, to their buyers. One traversal replaces a chain of
   one-off tools.
4. **Derived facts.** What follows from 1–3 by a named rule, with the chain shown
   (section 4). Never presented as stated.
5. **The open web.** SearXNG first (self-hosted on the box, free, already configured for
   Causius). Passages arrive as leads in their own channel, as today. A reader can add a
   key (Brave, Tavily, or a provider's own search tool) for their own session; the
   product never *requires* a paid key, and ours is not the default spend.
6. **An honest gap that is still useful.** When the climb ends short, the answer still
   says what *is* known, names the one missing link ("the buyers of Kazatomprom's output
   are not in our sources"), says which kind of source would settle it, and **files the gap
   as a task** (section 5). It never answers "not in our database" and stops.

The test is the eval file: rows tagged `wall: false` fail on any answer whose body is only
a refusal. A question that cannot be answered is graded on whether it produced a precise
gap, not on whether it said sorry.

### Provider search is not free, so it is a user choice

Checked 2026-10-24: Anthropic's web search tool is billed at $10 per 1,000 searches plus
the result tokens; Groq Compound lists $5 per 1,000 basic searches; OpenAI's web search is
$10–25 per 1,000 calls depending on model; Gemini's Search grounding has a free monthly
or daily allowance and then roughly $14–35 per 1,000. Only Gemini has a free tier, and it
is rate-limited and has changed more than once. So: **SearXNG is the default; a model's own
search is an option on the reader's own key (`byok`), which is exactly how customers will
scale it and how we use it ourselves.** `@bitbaum/ai-kit/web` stays the one seam.

## 2. Evidence grades

Every fact and every relation carries one grade, and the page prints it:

| Grade | Meaning | Shown as |
|---|---|---|
| `stated` | A source says it in words we can quote. | the quote, linked |
| `corroborated` | Two independent sources say it. | both quotes |
| `derived` | Follows from stated rows by a named rule; the chain is stored. | "worked out from …" with the chain |
| `lead` | Plausible, single weak source or a search snippet. | marked unverified, never counted |

`derived` and `lead` can be wrong; they are never mixed into a `stated` figure and never
raise a completeness score. A reader can always open the chain.

## 3. The relation graph

Entities already have identity (`lib/entities`). What is missing is the **edge**, a typed,
sourced, dated link. One shape for all of them:

```
Relation {
  id, from: EntityId, to: EntityId, type, grade,
  share?: { value, unit: 'percent' } | volume?: { value, unit, period },
  asOf: ISO date,                    // when it was true, not when we filed it
  evidence: { source, quote, readOn }[],   // one per independent source
  derivedFrom?: string[], rule?: string,   // only when grade = 'derived'
}
```

Types (closed set, extended by a deliberate edit): `operates`, `owns`, `finances`,
`supplies`, `buys_from`, `ships_to`, `licenses`, `regulates`, `researches`, `employs`,
`competes_with`. A flow edge carries a volume; an ownership edge a share.

Where the first edges come from, before any new research: the USGS operator strings
(`Operator [Owner, 62%]`) parse into `operates` + `owns`; the existing ownership rows,
participants, facilities and events become edges. Everything arrives through the same
candidate path as other rows (`config/candidates/relations.json`), so a cheaper model
can add them and the existing checks (schema, reachable source, quote present, no
duplicate) apply unchanged.

## 4. Connecting the dots, and knowing whether it worked

A private company has no filings. An analyst still finds it, because it sits in a chain
and the chain's other links are public. The rules are small and explicit, each producing
`derived` edges with the chain stored:

- **Listed counterparty.** A listed firm's filing names a customer or supplier (10-K
  "customers over 10%", 20-F related parties, offtake and royalty agreements, bond
  documents, NI 43-101 reports for mines). The private firm on the other end is an edge.
- **Registry links.** Parent, subsidiary and officer links from open registries (GLEIF
  LEI relationships, SEC EDGAR, Companies House, Wikidata). A shared registered address
  or officer is a `lead` until a second source agrees.
- **Trade and licence records.** Export licences, sanctions listings, customs and
  procurement notices that name an entity and a commodity.
- **Co-location.** A private operator at a USGS-listed site whose output a listed
  processor reports buying from that district.
- **Authorship and grants.** Patents, papers and grant acknowledgements tie labs to firms
  and to each other.

**The check that says whether the picture is good: mass balance.** For a resource and a
year, the facilities we have identified have a stated capacity; the national total is
published (USGS, WNA, Energy Institute). The **coverage ratio** is identified / national.
A country page says "we can name operators for 78% of Kazakhstan's uranium output" and
shows the unnamed remainder as the work still to do. The same test runs on flows: what
named buyers report importing against what the exporter reports shipping. A ratio far from
1 either way means a missing link or a wrong one, and it is how we find errors without
trusting any single source. The ratio is computed by code from `stated` and `corroborated`
rows only.

## 5. Dossiers, completeness, and a work queue that never goes stale

A *dossier* is the fixed set of boxes for a kind of entity (country: endowment and output;
facilities; companies; law and licensing; trade; events; people and labs. Company: what
it makes; where; owners; customers; suppliers; filings; risks; events. Lab and person:
what they work on; where; how to join; funding). `lib/dossier` holds the definitions and
**computes** each box as `full`, `thin` or `empty` from the rows that exist. Completeness
is a function of the data, never a flag someone sets.

From the dossiers the system **emits tasks**: one JSON record per empty or thin box with
the entity, the box, the allowed source list for that box, the output schema and an
example. That file is the whole interface to a cheaper model: it reads a task, finds the
sources on the list, writes candidate rows with `scripts/research/add.ts`, and the checks
decide. A second feed comes from questions: every answer that ends at rung 6 files its gap
with a count, so the order of work follows what people actually ask.

## 6. Free sources, by box

Already in the repo: USGS yearbooks and Mineral Commodity Summaries, World Nuclear
Association, Energy Institute, OECD export restrictions, EU and US sanctions. To add as
adapters (each returns rows in the candidate shape, with the quote): SEC EDGAR (free,
needs a descriptive user agent), GLEIF LEI and relationship records (free), Wikidata
(free), UN Comtrade (free registration), Companies House (free key), exchange filing
feeds (ASX, SEDAR+, KASE, LSE RNS), national mining cadastres (SERNAGEOMIN, INGEMMET,
provincial Canada, state Australia). Paid trade databases are out of scope; an analyst
without them uses the rules in section 4.

## 7. Build order

1. **Evidence and relations** (`lib/graph`): types, store, candidate file, USGS operator
   parser, tests. Everything else depends on the shapes.
2. **Dossiers and gaps** (`lib/dossier`, `scripts/research/gaps.ts`): definitions,
   completeness, task emission, a coverage page.
3. **The ladder** (`lib/chat-agent`, `lib/chat-tools`): `producers_in`, graph traversal
   tool, the no-wall answer, the web rung on SearXNG, gap filing, `wall:false` evals.
4. **Source adapters and the task runner**: the free sources above, and `add.ts` accepting
   a PDF source.
5. **Inference and mass balance** (`lib/graph/rules`, coverage ratio on country pages).
6. **Data**, country by country, in the order the owner named (the uranium belt first, then
   the lithium and copper Americas), each by emitting its dossier tasks.

Systems 1–3 are independent once the shapes in `lib/graph/types.ts` exist; 4 and 5 follow.
