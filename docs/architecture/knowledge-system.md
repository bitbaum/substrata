# ADR: the knowledge system — index, significance, data entry, primers, new kinds

Status: proposed, 2026-10-23. Read with [bitbaum/fleet AGENTS.md](https://github.com/bitbaum/fleet/blob/main/AGENTS.md)
("Producers", "Packages", "No dead ends") and `docs/INFRASTRUCTURE.md`.

The owner's words that set the bar (2026-10-23): Substrata must be showable to
hedge funds, money managers, journalists and think tanks. "Niger → oil before
uranium is a failure of a system." "Build the systems first, so later a less
sophisticated model can fill in the information." "Figure out how to have the
data and LLMs work efficiently — vector databases, labeling." "Clients will
want primers — PDF documents — on a material, on countries, eventually on the
forces that slow or accelerate: a politician, a party, who finances whom."

## 0. What exists, and the failure

- Corpus: `config/substrata*.ts` + `research/*.json` (USGS 19 chapters, EIA 4,
  OECD restrictions, sanctions, series, listings). Identity:
  `lib/entities/registry.ts`, 282 entities over 11 kinds
  (`lib/entities/types.ts`), each with `retrievalText`, `evidence`, `sources`,
  `topics`.
- Retrieval: `lib/research-index.ts` is an in-memory rarity-weighted word match
  over one document per entity. The planner `lib/chat-agent/plan.ts` is regexes
  + name matching; the system prompt (`lib/chat-agent/prompt.ts`) is stuffed
  with the page record and the planned lookups. `LOOP_LIMITS = {rounds: 3,
  callsPerRound: 4}`. ~15 tools in `lib/chat-tools/registry.ts`.
- The Niger failure, exactly: `lib/resources/headline.ts` `countryHeadline('ne')`
  ranks `countryResources('ne').measured` by world share. Niger's only directory
  resource is uranium (`config/substrata-resources.ts`), but `research/usgs-mcs.json`
  has no uranium chapter (USGS MCS does not publish one; uranium is IAEA/WNA/EIA)
  and `research/eia-energy.json` has oil. So the only measured row is oil at
  0.1 % (42nd), and `unmeasured: [{id:'uranium', hasTable:false}]` is computed
  and then dropped by the headline, the country entity's `summary`, the
  starters and the chat preload. The data is honest; the ranking ignores the
  gap. Part 2 fixes the ranking, Part 3 closes the gap.
- Database: Postgres, dedicated `substrata` DB/role provisioned by
  `scripts/provision-service.py` (runs as root). Tables in `scripts/db/001…015`.
  `research_snapshots(sha256, schema_version, data)` keyed by the export digest
  (`lib/research-export.ts`). Quality findings: `lib/quality/*`,
  `research_quality_checks`, `research_quality_runs`, shown at `/data/quality`.
- pgvector: NOT in substrata's DB. It IS on the box: Loki's `knowledge_embeddings`
  is `vector(384)` (`loki/src/db/schema/knowledge-embeddings.ts`). Extensions
  are per database, so substrata needs `CREATE EXTENSION vector` in its own DB.
- Embeddings: `@bitbaum/ai-kit` 1.21 has NO embedding chain. The box runs a
  local fastembed server, OpenAI `/v1/embeddings` shape, `BAAI/bge-small-en-v1.5`,
  384-dim, on `127.0.0.1:7997` (`loki/scripts/embed-server.py`). Loki and
  OrangeCat each carry a private copy of `embedTexts()`. Cost: zero, CPU on the box.
- AI budget: free chain only for readers (`lib/ai-budget.ts`);
  `test/no-free-background-ai.test.ts` fails any cron path to `freeChain`.
- Charts: `packages/chartkit` (Line, Bar, ShareBars, Sparkline, Meter, Timeline,
  StatTiles, SSR). Chromium exists on the box (`~/.cache/ms-playwright`).

## 1. Retrieval index (`research_index`)

### 1.1 Data model

Chunks are DERIVED from config on deploy; the corpus in git stays the SSOT. One
migration, `scripts/db/016-research-index.sql`, applied by `provision-service.py`
(root), which is what lets it run `CREATE EXTENSION IF NOT EXISTS vector` — the
app role cannot. The file also succeeds without the extension (the `embedding`
column is added in a second, guarded statement).

```sql
-- 016-research-index.sql (additive, idempotent)
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS vector; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS research_index (
  chunk_id     text PRIMARY KEY,            -- '<facet>:<row key>#<n>'
  content_hash text NOT NULL,               -- sha256(text + tags); re-embed only when it changes
  corpus_sha   text NOT NULL,               -- research-export digest the chunk was built from
  facet        text NOT NULL,               -- entity | event | series | policy | science | restriction | quality | quantity | facility | ranking
  kind         text,                        -- EntityKind of the primary entity, when it has one
  entity_ids   text[] NOT NULL DEFAULT '{}',-- every EntityId the chunk is about
  title        text NOT NULL,
  text         text NOT NULL,               -- <= 1200 chars: what is embedded and shown to the model
  href         text NOT NULL,               -- site page to cite
  source_url   text,                        -- primary source, when the row has one
  evidence     text NOT NULL,               -- sourced | candidate | unverified | judgement | computed | directory | finding
  as_of        date,                        -- the date the fact is FOR
  significance real NOT NULL DEFAULT 0,     -- 0..1, Part 2
  tsv          tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || text)) STORED,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_index_tsv ON research_index USING gin (tsv);
CREATE INDEX IF NOT EXISTS research_index_entities ON research_index USING gin (entity_ids);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') THEN
    EXECUTE 'ALTER TABLE research_index ADD COLUMN IF NOT EXISTS embedding vector(384)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS research_index_vec ON research_index USING hnsw (embedding vector_cosine_ops)';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS research_index_runs (
  id bigserial PRIMARY KEY, corpus_sha text NOT NULL, started_at timestamptz DEFAULT now(),
  finished_at timestamptz, chunks int DEFAULT 0, embedded int DEFAULT 0, skipped int DEFAULT 0,
  mode text NOT NULL -- 'vector' | 'lexical'
);
```

Chunk producers, one function per facet in `lib/index/chunks/<facet>.ts`:

| facet | rows from | chunk text | entity_ids | evidence | as_of | significance |
| --- | --- | --- | --- | --- | --- | --- |
| entity | `allEntities()` | `retrievalText` split at 1200 chars on sentence ends | self | entity.evidence mapped | — | `significance(entity)` |
| event | `EVENTS` (+ accepted json) | `date headline — effect on bottlenecks; participants; jurisdictions; quote` | bottlenecks, participants, countries | sourced/candidate | `date` | effect≠neutral ? 0.7 : 0.4, × recency |
| series | `research/series.json`, official series | `label: latest value unit (date), prior, change; source` | bottleneck/company | sourced | latest point | 0.5 |
| policy | `INSTRUMENTS` | `title (jurisdiction, body, status, date): summary; proponents` | policy, bottlenecks | sourced | `date` | in force ? 0.7 : 0.4 |
| science | `SCIENCE` | `name (readiness n/9): plain; relieves X; next milestone` | science, bottlenecks | judgement / sourced | `judgedOn` | readiness/9 |
| restriction | `research/oecd-export-restrictions.json` | `country restricts resource: measure, since year` | country, bottleneck | sourced | start year | country share on that resource |
| quantity | `substrata-quantities.ts`, `facilities.ts` | `material stage: value unit year (basis), place; source` | bottleneck, country, facility | sourced | `year` | share of world |
| ranking | `resourceRanking(r)` rows | `Country: n % of world R, rank k, year; reserves …` | country, resource | computed | table year | share |
| quality | pure `CheckResult.failures` + stored verdicts | `dataset/check: row — problem` | the row's entity ids | finding | run date | 0.3 (retrievable, never leads) |

### 1.2 Code modules

- `lib/index/chunk.ts` — `Chunk` type, `chunkId`, `contentHash`, `splitText` (pure).
- `lib/index/chunks/*.ts` — the nine producers; `lib/index/build.ts` `buildChunks(): Chunk[]`.
- `lib/index/embed.ts` — `embedTexts(inputs)` against `EMBEDDINGS_BASE_URL`
  (default `http://127.0.0.1:7997/v1`, model `BAAI/bge-small-en-v1.5`, dim 384,
  batch 48); null per input on failure; `embeddingsEnabled()`. Same env names as
  Loki so one box config serves both. This becomes the package function (§6).
- `lib/index/store.ts` — `upsertChunks`, `pruneMissing(corpus_sha)`, `hasVector()`,
  `lexicalSearch(q, k)`, `vectorSearch(vec, k)`.
- `lib/index/retrieve.ts` — `retrieve(question, {k, entityHints, facets}): Hit[]`.
  Hybrid score: `0.45·lexical(ts_rank_cd, normalised) + 0.35·cosine +
  0.15·significance + 0.05·recency(as_of)`; without vectors the lexical weight
  takes the cosine share. An in-process implementation over `buildChunks()`
  reuses `scoreDocuments` from `lib/research-index.ts`, so tests and a laptop
  with no DATABASE_URL run the same ranking minus vectors.
- `scripts/index/reindex.ts` — `pnpm run index:reindex [--lexical]`: builds
  chunks, computes `corpus_sha` from `researchExport().sha256`, upserts rows
  whose `content_hash` changed, embeds only those, prunes chunk_ids absent from
  this build, writes a `research_index_runs` row. Run on the box after deploy
  with the runtime `DATABASE_URL`, like `scripts/capture-snapshot.ts`; plus
  `appcron-substrata-reindex` daily at :05 calling `POST /api/cron/reindex`
  (allowed by `no-free-background-ai`: it never touches a chat model).
- `lib/chat-agent/plan.ts` — step 0: `retrieve(question, {k: 8, entityHints})`
  → `Plan.hits`. Entity ids on the top hits (not regex) decide the record calls;
  the regex intent table stays for the tool choice. `confident` requires a hit
  with `evidence ≠ 'finding'` above a floor.
- `lib/chat-agent/prompt.ts` — the preloaded block shrinks to the page's
  `knownFor` line (Part 2) plus the top-k hits as `## Relevant records
  (retrieved)`, each with evidence state, as-of and href. Exact rows still come
  from tools; retrieval tells the model what to call.
- `lib/chat-tools/records.ts` `search_corpus` runs `retrieve()`.
- `/data/quality` gets an "Index" card: last run, mode, chunks, stale chunks, eval score.

### 1.3 Evaluation

`test/ask-evals.json`, one row per question:

```json
{ "id": "niger-uranium", "question": "What is Niger known for?", "path": "/world/ne",
  "mustMention": ["country:ne", "bottleneck:uranium-conversion-and-enrichment"],
  "mustNotLead": ["oil", "natural gas"],
  "expectedTools": ["resource_production"],
  "expectedHits": ["entity:country:ne#0"],
  "gap": "resources/directory-unmeasured" }
```

- `test/ask-evals.test.ts` (no model, no DB): for every row, `retrieve()`
  in-process returns `expectedHits` within the top 5; `planLookups()` includes
  `expectedTools`; the knownFor line for the page entity does not START with any
  `mustNotLead` term; where `gap` is set, that quality check currently reports
  the row — so an eval that documents a gap turns red the day the gap closes
  and the eval needs updating. That is the ratchet in the right direction.
- Nightly with a model: `scripts/index/eval-run.ts` writes
  `research_eval_runs(id, ran_at, model, corpus_sha, asked, passed, failures jsonb)`
  (same migration), read by `/data/quality`. Pass: every `mustMention` entity's
  name or href in the answer, no `mustNotLead` term in the first sentence. The
  model call goes through `lib/byok-ask.ts` on an OPERATOR key
  (`SUBSTRATA_EVAL_BYOK`), never the free chain. Without that env the nightly
  records `skipped: 'no eval key'` and the page says so.

## 2. Significance and "known for"

### 2.1 Model (derived, never stored in config)

```ts
// lib/known-for.ts
export interface KnownForItem {
  entity: EntityId; label: string;
  basis: 'world-share' | 'severity' | 'producer-rank' | 'directory' | 'holding';
  value: number | null;            // share 0..1, severity 0..12, rank
  text: string;                    // "31 % of world uranium (2nd, 2025)" | "directory says uranium; no production table joined yet"
  evidence: 'computed' | 'directory' | 'judgement' | 'sourced';
  href: string; source?: string;
}
export interface KnownFor { items: KnownForItem[]; gaps: KnownForItem[]; line: string; significance: number }
export function knownFor(id: EntityId): KnownFor
export function significance(id: EntityId): number   // 0..1, used by the index
```

Rules per kind, each a pure function in `lib/known-for/<kind>.ts`:

| kind | items, in order | floor | gaps |
| --- | --- | --- | --- |
| country | measured resources by world share where share ≥ 1 % OR rank ≤ 10; then `unmeasured` directory resources as `basis:'directory'` ("directory says X; no production table joined yet"); then measured resources under the floor | 1 % / top 10 | every directory item without a table |
| company | bottlenecks it holds, by the bottleneck's `score` desc, verified rows before unverified | — | an unverified `produces` row |
| bottleneck (material) | top 3 producer countries by share; the chokepoint it feeds; its score/12 | — | no joined table |
| policy / science / capital | the bottlenecks they bear on, by score | — | — |

`significance(id)`: country = max share (0.2 if only directory); company = max
score/12 of held bottlenecks; bottleneck = score/12; others 0.3.

Niger after this: "Known for: uranium — directory says uranium; no production
table joined yet. Measured: 0.1 % of world oil (42nd, 2024)." The gap leads
because a directory item outranks a measured share under the floor, and it says
in words that it is a gap.

### 2.2 Consumers to change

- `lib/resources/headline.ts` → `countryHeadline` delegates to `knownFor(...).line`.
- `lib/entities/sources/country.ts` summary/evidence/retrievalText from `knownFor`.
- `lib/chat-context.ts` `preloadPage` prepends the knownFor line.
- `lib/starter-facets.ts` country/company generators pick from `items[0]`, never a gap.
- `lib/index/chunks/entity.ts` reads `significance()`.
- Quality: pure check `resources/directory-unmeasured` in
  `lib/quality/checks-resources.ts` (dataset `resources`, criterion
  `completeness`): one failure per `(country, resource)` with `hasTable:false`.
  It is a row on `/data/quality` and a chunk in the index, so a data task (Part 3,
  task 1) can close it and the eval `gap` field proves it closed.

### 2.3 Gates

`test/known-for.test.ts`: no `world-share` item under the floor precedes a
directory item, for every country; `knownFor('country:ne').line` starts with
"uranium"; every country with directory resources and no measured rows has
non-empty `gaps`; the quality check count equals the sum of gaps.

## 3. Data-entry contract for cheaper models

### 3.1 Where candidate rows live

Config stays TypeScript; a cheap model never edits TS. Each facet gets a JSON
sidecar the config module includes, in the pattern of
`config/substrata-events-accepted.json`:

```
config/candidates/<facet>.json   facet ∈ producers | events | endowments | facilities | instruments | science | ownership | series-points
```

Every candidate row carries `evidence: 'candidate'` (the type forbids
`'sourced'` in this file), `source: { url, quote, readOn }`, `asOf`, and
`submittedBy: { agent, model, runId }`. The config module merges
`[...TS rows, ...candidates]`. Readers already render `candidate` as
"Candidate source".

### 3.2 Schemas

`lib/entry/schemas.ts`: one Zod schema per facet, each `satisfies
z.ZodType<ConfigRow>` against the config type so TS fails the build when the two
drift. Common part:

```ts
const Source = z.object({ url: z.url(), quote: z.string().min(20).max(400), readOn: isoDate });
const Candidate = z.object({ evidence: z.literal('candidate'), asOf: isoDate, source: Source,
  submittedBy: z.object({ agent: z.string(), model: z.string(), runId: z.string() }) });
export const EndowmentEntry = Candidate.extend({ material: bottleneckSlug, place: iso2,
  stage: z.enum(['mine','refine','convert']), production: Quantity.optional(), reserves: Quantity.optional() });
export const OwnershipEntry = Candidate.extend({ company: companySlug, holder: z.string(),
  holderEntity: entityIdOptional, kind: z.enum(['parent','state','fund','listed-float']),
  share: z.number().min(0).max(1).optional() });
export const EventEntry = Candidate.extend(CoverageEventShape);  // reuse lib/event-rules.ts
```

Slugs resolve through `resolveIn(kind, …)`, so a candidate cannot name an
entity that does not exist.

### 3.3 The script and the gates

`scripts/research/add.ts <facet> <json-file|-> [--branch] [--dry-run]`:
1. parse with the facet schema; 2. `GET source.url` (ai-kit's SSRF guard, 3
   tries, 15 s) must be 200 and the page text must contain `quote` verbatim
   after whitespace folding (the `lib/event-rules.ts` rule); 3. reject
   duplicates; 4. append to `config/candidates/<facet>.json` sorted; 5. with
   `--branch`, commit and open the PR with a body listing each row's url and
   quote. Exit codes: 2 schema, 3 source unreachable, 4 quote absent, 5 duplicate.
- `test/candidates.test.ts`: every row passes its schema; `evidence ===
  'candidate'`; `source.url` and `asOf` present; `asOf <= today`; entity refs
  resolve. CI refuses the PR otherwise. The quote-on-page check is re-run by the
  quality job's existing `quote` kind.
- Promotion: `/review` gets a "Candidates" tab listing rows with the quote
  beside the fetched page text. Accept writes
  `research_candidate_promotions(facet, key, actor_id, accepted_at)`; the
  hand-carry path (`scripts/research/promote.ts`, sibling of `accept-events.ts`)
  moves the row from JSON into the TS config with `source` set — the only way
  `'sourced'` is ever written.

### 3.4 Prompt template for the data agent (`prompts/data-entry.md`)

```
You add ONE facet of data to Substrata. You may write only a JSON array for `scripts/research/add.ts <facet>`.
You may not edit config/*.ts, lib/, or tests. You may not write evidence other than "candidate".
Every row: a primary source URL (publisher, regulator, company filing, USGS/IAEA/EIA table), a quote of
20–400 characters copied verbatim from that page, readOn = today, asOf = the date the fact is FOR.
Numbers: value + unit + year + basis ('reported'|'estimated'); never a bare number. No share, rank or
"largest" words — those are computed. If a source is paywalled or you cannot quote it, omit the row
and list it under "skipped" with the reason. Shape: `add.ts <facet> --schema`.
Run `add.ts --dry-run` and fix every exit code before opening the PR.
```

### 3.5 First 10 data tasks (one PR, one facet, one cheap-model session each)

1. Uranium production + reserves by country (WNA/IAEA, EIA) → `endowments`;
   closes `resources/directory-unmeasured` for NE, KZ, NA, CA, AU, UZ, RU.
2. Ownership of the 10 lead companies by bottleneck score → `ownership`.
3. Events 2026-Q1..Q3 for the 10 highest-scored bottlenecks → `events`.
4. Facilities for helium, neon, xenon, GOES → `facilities`.
5. Producer sources for the `verification:'unverified'` rows → `producers`.
6. Rare-earth separation capacity by plant → `endowments` stage `refine`.
7. Policy instruments 2026: EU CRMA acts, US BIS rules, CN MOFCOM controls → `instruments`.
8. Series points: transformer lead-time and GOES price refresh → `series-points`.
9. Xenon/krypton: air-separation capacity and the Ukraine/Russia share claims → `endowments` + `events`.
10. Science readiness: `nextMilestone` evidence for the 15 entries with `source: null` → `science`.

## 4. Primers

### 4.1 Template schema

```ts
// lib/primers/template.ts
export interface PrimerTemplate { kind: EntityKind; sections: Section[] }
export interface Section {
  id: string; title: string;
  query: { facets: Chunk['facet'][]; k: number; mustInclude?: 'self' };  // retrieve() scoped to entity_ids ∋ self
  rows: (entity: Entity) => Row[];        // exact rows from lib/ functions, never from the model
  chart?: (entity: Entity) => ChartSpec | null;   // chartkit
  bridge?: boolean;                        // a model may write ≤120 words connecting the rows above; marked
  required: boolean;                       // a required section with no rows renders "No table joined yet" + the finding
}
```

Templates: `lib/primers/templates/{material,country,company,bottleneck}.ts`.

### 4.2 Example: material primer for xenon (`/primers/material/xenon`)

| # | section | rows | chart | bridge |
| --- | --- | --- | --- | --- |
| 1 | Cover | name, `knownFor.line`, score/12 with judgedOn, corpus digest, honesty line, evidence legend | StatTiles | no |
| 2 | What it is and why it binds | `plain`, `rationale`, chokepoint-test factors | Meter | yes |
| 3 | Where it comes from | `resourceRanking` if a table exists; else quantities/facilities; else required-empty | ShareBars by country | no |
| 4 | Who makes it | producers with role, jurisdiction, verification; holders | BarChart | yes |
| 5 | Routes and restrictions | restrictions, sanctions | Timeline | no |
| 6 | Dependencies | upstream + downstream with quotes | — | yes |
| 7 | Substitutes | status, blockedBy, why | — | no |
| 8 | Relief science | entries relieving it, readiness, next milestone | BarChart | no |
| 9 | Policy | instruments by jurisdiction and status | — | no |
| 10 | Listed exposure | listed / via parent / private, tickers verbatim | — | no |
| 11 | Timeline | events, newest first | Timeline | no |
| 12 | Series | each series: latest, prior, change | LineChart | no |
| 13 | Gaps | quality findings whose entity_ids ∋ self | — | no |
| 14 | Sources | every URL used above, deduplicated, with evidence state and readOn | — | no |

### 4.3 Rendering and PDF

- Page: `app/primers/[kind]/[key]/page.tsx` renders `buildPrimer(kind, key)`
  from `lib/primers/build.ts`; sections use chartkit (SSR SVG) so the print view
  needs no client JS. `?print=1` switches to `print.css` (A4, page breaks, running
  footer "Substrata · corpus <sha7> · evidence states as marked · not investment advice").
- PDF: `app/primers/[kind]/[key]/pdf/route.ts`. Chromium print ON THE BOX, ON
  DEMAND, cached on disk by `(corpusSha, kind, key)`. Not a build step: 282
  entities × a re-render per deploy is waste when few primers are downloaded.
  Not a client print: charts and footers must be identical for every reader and
  carry the digest. `playwright-core` with `SUBSTRATA_CHROMIUM` pointing at the
  box's Chromium; one render at a time; a miss while another render runs returns
  202 "Rendering — retry in 10 s". Without `SUBSTRATA_CHROMIUM` the route serves
  the print page with "Print to PDF from your browser".
- Versioning: `corpusSha` in the footer, the filename and a `primer_renders` row.
- Model's role: `bridge` sections only (`lib/primers/bridge.ts`): ≤120 words that
  may only reference the rows passed in; a sentence holding a figure not in the
  rows is dropped (`unsupportedFigures` from `lib/chat-agent/grounding.ts`).
  Rendered in a box headed "Model prose — connects the sourced rows above; not
  itself a source". On the reader's key or the operator eval key; absent both,
  the box is omitted. Never on the free chain.
- Gates: `test/primers.test.ts` — every required section renders rows or the
  gap line; every row carries an evidence state from the closed set; every
  source in §14 appears in some row; xenon and Niger build without DB.

## 5. Person, party, force — schema and admission only

```ts
export const ENTITY_KINDS = [...existing, 'person', 'party', 'force'] as const;
export const RELATION_KINDS = [...existing, 'finances', 'influences', 'member-of', 'holds-office-in'] as const;
```

| kind | what it is | required fields | evidence it must carry |
| --- | --- | --- | --- |
| person | a named individual holding public office, a board seat or a controlling stake that bears on a tracked bottleneck | `office: {body, title, since}` or `seat: {company, role}`; `jurisdictions` | a public register or filing URL, `asOf`; no biography prose without a source |
| party | a party or caucus that has voted on or proposed a tracked instrument | `jurisdiction`, `seats?` | the official register URL; each `influences` cites the vote or document |
| force | a lobby, fund, treaty regime, sanctions programme or movement that slows or accelerates a bottleneck | `kind`, `direction: 'slows' \| 'accelerates'`, `bottlenecks` | at least one `influences` relation with a source and quote; refused at build otherwise |

`finances` requires a filing, donation register or audited report and a quote
naming the amount or stake. `influences` requires a quote and scope. Both default
to `candidate` through Part 3 and read `sourced` only after promotion. The truth
gate bans "controls"/"owns" without a `finances` row behind it. Adapters return
`[]` with `allowEmpty: true` and a dated reason until data exists.

## 6. Package or Substrata-only

- `@bitbaum/indexkit` — a package: chunk type, `embedTexts` (third copy in the
  fleet today), `hybridScore`, the pgvector-or-tsvector store with the same
  migration shape, `reindex` by content hash, and the eval harness. It stores no
  names or hosts; each app supplies chunk producers and the DB. Loki and
  OrangeCat are the second and third adopters. Substrata ships the first
  implementation under `lib/index/` with the package boundary respected;
  extraction is one PR.
- Primer renderer — Substrata-only for now: one adopter, corpus-shaped
  template. The PDF print route is the generic part and moves to a package the
  day a second product needs a document from rows.
- knownFor, data-entry schemas, candidates desk — Substrata-only: the corpus's rules.
- chartkit is already the package for every chart here.

## 7. PR sequence

| # | PR | size | proves | parallel with |
| --- | --- | --- | --- | --- |
| 1 | `lib/known-for.ts` + quality check `resources/directory-unmeasured` + headline/country/preload/starters consumers + tests | M | Niger says uranium first; `/data/quality` lists the directory gaps | 3, 5 |
| 2 | `test/ask-evals.json` (20 rows incl. niger-uranium) + `test/ask-evals.test.ts` over the planner and the in-process retriever | S | the failure is a red test before any index exists | 1 |
| 3 | `lib/index/` chunks + in-process `retrieve()` + `search_corpus` on it | M | search and chat see events, series, policy, restrictions, findings as retrievable rows | 1, 5 |
| 4 | `016-research-index.sql` + store + `reindex.ts` + `/api/cron/reindex` + `/data/quality` card; applied on the box | M | a reindex embeds only changed chunks; mode shown on /data | 5 |
| 5 | `lib/entry/schemas.ts` + `config/candidates/*.json` + `add.ts` + `test/candidates.test.ts` + `prompts/data-entry.md` | M | a row without url+asOf fails CI; a quote not on the page fails add.ts | 1, 3 |
| 6 | planner uses `retrieve()` hits and the prompt's retrieved block | M | ask-evals pass with the fake model; measured questions still one call | after 3 |
| 7 | Data task 1 (uranium table) via add.ts; eval gap field removed | S | the loop closes: finding → task → candidate → review → sourced | after 5 |
| 8 | `/review/candidates` tab + `promote.ts` | M | candidate → sourced only through a person | after 5 |
| 9 | nightly eval runner on the operator key + `research_eval_runs` card | S | model-in-the-loop score on /data/quality | after 4, 6 |
| 10 | `lib/primers/` template + build + `/primers/[kind]/[key]` + tests (xenon, Niger) | L | a primer renders from rows only; gaps section lists the findings | after 1, 3 |
| 11 | PDF route + print.css | M | same PDF bytes for the same digest; 202 while rendering | after 10 |
| 12 | bridge prose | S | a bridge sentence with an unsourced figure is dropped | after 10 |
| 13 | person/party/force kinds + relations + admission tests, empty adapters | S | the build refuses a force with no sourced relation | after 1 |
| 14 | extract `@bitbaum/indexkit`; Loki and OrangeCat adopt | L | three `embedTexts` become one | after 4, 6 |
| 15 | data tasks 2–10, one PR each on the Part 3 contract | S each | each closes named findings; primers fill in | after 8 |

Parallel lanes: {1, 2} → {3, 5, 13} → {4, 6, 7, 8} → {9, 10} → {11, 12, 14, 15}.
