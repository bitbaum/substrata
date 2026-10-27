# ADR: the frontier registry — a list of entities we deliberately track

Status: accepted, 2026-10-28. Read with `docs/architecture/2026-10-25-company-universe.md`
(the filter this replaces as the list), `docs/architecture/2026-10-27-company-exposure.md`
(what constrains a company) and `docs/architecture/2026-10-23-knowledge-system.md`
(the cited-row discipline every row here keeps).

The owner's brief, 2026-10-28: think of all the technologies that will drive
progress toward the singularity; every company in them has to be in our
database, public or private, American, European, Chinese, a lot of them. That
includes the frontier labs, the robotics firms and the companies in their supply
chains (actuators, reducers, sensors, batteries, magnets, compute, memory,
packaging, foundry, power, cooling, networking, optics), and the other areas
that matter (bio and longevity, fusion and fission, quantum, neurotech, space,
autonomous vehicles, synthetic biology, advanced materials, defence-tech,
storage, data centres, AI chips). A lot of data, one source of truth, **easy to
add a company because they pop up all the time**, and the areas themselves are
first-class. Customers are institutional investors, analysts, strategists and
policymakers.

## 0. The diagnosis, verified in code on 2026-10-28

Today's list is a **filter over public data**, not a **registry of things we chose
to track**.

- `lib/universe/admit.ts` admits a company when it passes three tests (theme,
  materiality, identity) on rows that adapters read from ETF holdings files, SEC
  industry codes, GLEIF and Wikidata (`docs/architecture/2026-10-25-company-universe.md`).
- Materiality is a floor on a figure those sources print: a fund position over
  US$5 million, a public float over US$250 million, a private valuation over
  US$1 billion that a person quoted. A private lab with no Form D, no S-1 and no
  fund holding **cannot** qualify however important it is. OpenAI, Anthropic,
  DeepSeek, Moonshot, Figure, Unitree and Physical Intelligence are therefore
  "considered, not admitted" or absent (`config/universe-considered.ts`).
- Funds that print weights not market values (State Street, Defiance) cannot clear
  the floor, and iShares, Invesco and VanEck files are unreadable from the
  sandbox, so most large non-US names are out for a reason about the sources.
- Absence says nothing: the filter's answer to "why is X not here" is "no source
  we read happens to hold it".
- Every fact lives in `research/universe.json` as an evidence row per company per
  source; there is no place to say "we track this one on purpose, here is what it is".

Fixing this by lowering floors makes "theme" meaningless (the 2026-10-27 wave
tried KOMP and XME and admitted 1,063 companies of no relevance). The fix is a
different object: a **registry**. A person or an agent decides an entity belongs,
on a cited reason, and from then on it is in. Funds, EDGAR, GLEIF and Wikidata
become what they are good at: **proposers**.

## 1. Decision

1. **One entity registry is the list.** An entity is in because it is registered,
   not because a floor was cleared. `registry/companies/<slug>.json`, one file per
   entity.
2. **Areas are data.** `registry/areas/<slug>.json`, one file per area, with a
   hierarchy, a definition, why it matters for the trajectory, linked bottlenecks,
   and the same evidence rules.
3. **Everything cited or absent.** A field that is present has a source URL that was
   actually opened, a literal quote, the date it was read, and the date it is
   true for. A field with no citation is not a field; it is a **gap**, listed, and
   it is a research task.
4. **Adding is one command or one file.** `pnpm run company:add`. The page exists the
   moment the file is merged, in an honest mostly-gapped state.
5. **Proposers never write the list.** They write a review queue.
6. **No page breaks.** `/markets/<slug>` stays the company's URL; every current
   slug stays. The universe file keeps feeding evidence for companies it already
   admits.

### 1.1 Why a file per company, and not a table or one big file

| Option | For | Against | Verdict |
| --- | --- | --- | --- |
| One JSON array | trivially loaded | every add edits the same file: merge conflicts at 20 PRs a day, unreviewable diffs, the 4 MB of `research/universe.json` already shows the limit | no |
| SQLite or a database | queries | binary diff, no review, a service to run, nothing the sandbox agents can edit with a text tool | no |
| A CSV or YAML table | compact | citations per field do not fit a row; quoting breaks; a YAML parser dependency | no |
| **One JSON file per entity** | a PR that adds a company is one new file (zero conflicts); `git log registry/companies/openai.json` is the audit trail of every claim; reviewers read one entity; agents write it with a text tool; validated by one schema; scales to 5,000 files (git handles tens of thousands) | a loader has to read a directory | **yes** |

JSON over YAML or TOML: the repo already validates JSON with zod
(`lib/entry/schemas.ts`), prettier formats it deterministically, and agents
produce it reliably. Files are sorted-key and 2-space (prettier) so diffs are
line-per-fact.

**Loading.** The loader reads the directory at server start (the same pattern as
`lib/notes.ts`), validates every file with the schema and fails loudly on a bad
one in tests and build. At 2,000 to 5,000 entries (about 3 KB each) that is 6 to 15
MB read once per process. If it ever hurts, a build step may bundle it; the files
stay the source.

### 1.2 The company record

```jsonc
{
  "slug": "anthropic",                 // URL: /markets/anthropic. Immutable once merged.
  "name": "Anthropic",
  "aliases": ["Anthropic PBC"],
  "kind": "lab",                       // public | private | lab | subsidiary | state-owned
                                       //   | consortium | university-lab | non-profit
  "status": "active",                  // active | acquired | defunct | merged | dormant
  "statusNote": null,                  // "Acquired by X on 2025-03-01" must carry evidence
  "country": "US",                     // ISO 3166 alpha-2 of the HQ (registry-stated)
  "hq": "San Francisco",
  "jurisdictions": ["US"],             // where it is incorporated or listed, if different
  "ids": {                             // every id optional; each carries evidence
    "ticker": null, "exchange": null, "isin": null, "cik": null,
    "lei": null, "qid": "Q…", "domain": "anthropic.com", "registry": null
  },
  "parent": null,                      // slug of the owner, or null; evidence required
  "areas": [                           // many to many with the area taxonomy
    { "area": "frontier-ai/labs", "role": "Trains and serves frontier language models." }
  ],
  "summary": "…",                      // one sentence: what it is. QUOTED, not paraphrased
  "figures": [],                       // private-company numbers, see section 4
  "evidence": [                        // one row per cited field
    { "field": "summary", "grade": "stated", "source": "https://…",
      "quote": "…", "readOn": "2026-10-28", "asOf": "2026-10-28" }
  ],
  "origin": { "by": "company:add", "proposer": null, "on": "2026-10-28" }
}
```

Rules the validator enforces (no review needed to catch these):

- `slug` is `[a-z0-9-]+`, equals the file name, and is unique across registry and
  every current `/markets` slug.
- Every present value of `summary`, `kind`, `country`, `hq`, `parent`, `status` and each
  `ids.*` has an evidence row naming that field. No row, no value.
- An evidence row has an https source, a quote of at least 20 characters,
  `readOn` and `asOf` dates, a grade, and is not dated in the future.
- `grade` is one of `stated` (the entity or a primary document says it),
  `reported` (a named publisher says it, quoted), `registry` (a structured
  record such as Wikidata, GLEIF or EDGAR says it), `estimated` (a named third party's
  estimate, never ours). Our own arithmetic is `derived` and names its inputs.
- `areas` refer to areas that exist; a `role` is free text but is part of the
  claim and needs an evidence row field `area:<slug>` or it is shown as
  "editorial: Substrata's placement" (see section 2).
- `kind: public` needs a ticker and exchange, or it is `private`; a kind change is a diff.
- No model identifier, no price, no number without a source.

**What the loader derives, never stores:** gaps (every field of the frame
without evidence), page kind (`filer | quote | identity`, from ids), the theme (from
areas, section 2), counts. Derived data cannot drift because it is not data.

### 1.3 Evidence per field: where each field comes from

| Field | Primary sources, in order | Notes |
| --- | --- | --- |
| summary, kind, role | company's own about page or filing (quoted); else Wikipedia's lead sentence | the quote is what the reader sees |
| country, hq | company contact or filing cover page; Wikidata P159 and P17 as `registry` | a Wikidata row is a record, quoted as the rendered statement |
| ticker, ISIN, CIK, LEI, QID | SEC `company_tickers.json`, GLEIF API, Wikidata, exchange issuer pages | already used by `lib/sources/registry-ids.ts` |
| parent, status | filings (subsidiary lists, Exhibit 21), registers, press release | acquisition needs the release |
| areas | the summary's own words, or a company or filing sentence | else editorial and labelled |

## 2. The area taxonomy

Areas are the other half of the product. Customers read the world by area: "who
makes the chips, who funds the labs, where are the humanoids' actuators made".

```
registry/areas/<slug>.json          one file per area; slug is a path of a single word-dash
```

```jsonc
{
  "slug": "humanoid-actuators",
  "name": "Humanoid actuators",
  "parent": "robotics",              // hierarchy: one parent, null at the root
  "theme": "robotics",               // existing ThemeId, so the rule and old filters keep working
  "definition": "…",                 // what is in and out, in two sentences
  "why": "…",                        // why it matters for the trajectory: what it gates or is gated by
  "bottlenecks": ["rare-earth-magnets"],  // slugs of lib/bottlenecks.ts, validated
  "keyNumbers": [ { "label": "…", "value": "…", "evidence": {…} } ],
  "evidence": [ … ]                  // for the definition, if sourced; else editorial and shown so
}
```

- **Hierarchy** is a tree by `parent`, depth at most three. Seeded roots (each a
  branch of the tree the site already has as `THEMES` in `config/universe-themes.ts`):
  frontier AI (labs, models, evaluations), AI chips and accelerators, compute supply
  chain (foundry, memory, packaging, equipment, networking, optics), data centres and
  cooling, power (fission, fusion, grid, storage), robotics (humanoids, industrial,
  actuators, reducers, sensors, batteries, magnets, hands), autonomous vehicles,
  space (launch, satellites, in-space compute), quantum, neurotech and BCI,
  bio and longevity, synthetic biology, advanced materials and critical minerals,
  defence-tech. The final tree is data in the repository, not text here.
- **Many to many.** A company sits in several areas with a role in each. Area pages
  are views, never copies: the member list is every registered company with the area,
  with descendants rolled up.
- **Editorial vs evidenced.** An area's `definition` and `why` are Substrata's
  framing and are labelled so on the page ("Our framing"). Any number, date or
  claim about the world needs a cite exactly like a company field. A `keyNumber`
  with no evidence does not load.
- **Old themes** (12) remain as a coarse filter, derived from `areas[].theme`.

## 3. Proposers, the review queue and what stays of the universe

```
proposers ──► registry/queue (candidate rows) ──► human or agent review ──► registry/companies/<slug>.json
(funds, EDGAR, GLEIF,     proposal = {name, why proposed,       decision: accept (file) | reject
 Wikidata, scout)          source + quote, suggested areas}                (reason kept in a considered log)
```

- The existing adapters keep writing evidence rows to `research/universe.json`.
  They are proposers: a row for a company that is not in the registry becomes a
  proposal; a row for one that is in becomes a **refresh** of that company's
  evidence (a fresher quote the reviewer may accept).
- The three tests of the old rule survive as **proposer ranking**: a candidate that
  passes all three is a strong proposal; one that fails materiality is still
  reviewable, because a private lab always will fail it. The tier word on a page is
  unchanged for the 793 companies already admitted.
- A rejected candidate is logged with a reason (as `config/universe-considered.ts`
  does), so "why is X not here" always has an answer.
- **Staleness** stops being exit. A registered entity never disappears because a
  source aged; its stale fields are shown as stale and queue a refresh task. This is
  the right default for a registry and the opposite of a filter.

### 3.1 The scout

`pnpm run company:scout` reads open sources for **new names** and writes proposals,
never entries:

| Source | Signal | Terms |
| --- | --- | --- |
| arXiv API (export.arxiv.org, free, rate 1 request per 3 seconds) | affiliation strings on frontier-ML and robotics papers: new lab names | arXiv API terms; metadata CC0 |
| SEC EDGAR Form D feed (`efts` full-text search and daily index) | a private raise by a name in a theme: stated amount, date, issuer | public domain; 10 requests per second max, declared user agent |
| Hugging Face and GitHub organisation lists | orgs publishing frontier weights or robotics stacks | HF and GitHub public APIs, rate limited; no scraping |
| Government lists | US Entity List (BIS), OFAC SDN, DoD 1260H (Chinese military companies), EU sanctions lists, CHIPS Act and DOE award lists | public domain or open data; also feeds sanctions exposure |
| Wikidata SPARQL | instances of company with an industry class in an area | CC0; one query per area, throttled |
| Funding-round press | name and stated amount, only with the publisher and quote | **no scraping**: we read a page only when its robots.txt allows it and keep a quote of one or two sentences; otherwise the proposal says "see the publisher" and stops |

A proposal says why it was proposed. A person or an agent decides; the add
command turns an accepted proposal into a file.

## 4. The private-company data policy

Private companies are most of the interesting labs. The policy is stricter than
for public ones, because there is no filing to lean on.

1. **Only cited figures.** Funding rounds, valuations, investors, headcount,
   compute disclosures and revenue come only from: the company's own post or
   page; an SEC filing (Form D, S-1, F-1, prospectuses, 8-K of a partner); a court
   or regulatory filing; a government register (Companies House, Handelsregister,
   HKEX, SSE, CNIPA, SAMR via open pages); a press release of a named investor;
   or a named publisher's report **with a literal quote**.
2. **Three labels, always shown.** `stated` (the company, the investor or a filing
   says it), `reported` (a named publisher says it, with the publisher shown),
   `estimated` (a named third party's estimate). The page prints the label next
   to the number. We never estimate ourselves and never average.
3. **Never invent, never round up, never convert.** A valuation is the sentence's
   currency and date. We do not state a "post-money" the source did not.
4. **A figure has a date it is true for.** A round of 2024 is not "the valuation".
   The ladder (section 6) shows each round with its date.
5. **Anonymous sources do not count.** "People familiar with the matter" is
   `reported` only if the publisher is named and the sentence is quoted; the
   label says "reported, unnamed sources".
6. **Withdrawn is withdrawn.** If the source disappears or is corrected, the
   figure is removed on the next refresh; the refresh task checks it on its
   `asOf` clock (`MAX_AGE_DAYS`, extended with a `private-figure` family of 365 days).
7. **No quotes.** A private company has no share price. The page says "private"
   and shows no ticker, no chart and no market cap, ever. SpaceX, xAI, OpenAI and
   the rest follow this like any other private entity.

### 4.1 China

Open, citable sources, in order: SSE, SZSE and STAR Market announcements and
prospectuses (listed firms and every IPO filer); HKEX filings (the best English
source: prospectuses, results, connected-person disclosures); the company's own
announcements and WeChat official posts; Wikidata and GLEIF; official registers
that publish open pages (SAMR's national enterprise credit information system for a
confirmed company name and registered capital, where its terms allow); US-side
filings (F-1, 20-F, 13F-listed holdings, 1260H and Entity List entries); and
reputable English-language reporting with a quote and the publisher named.

**Not used:** Tianyancha, Qichacha and similar aggregators (closed or ToS
forbids scraping), Weibo scraping, any paywalled terminal. If a figure exists
only there, it is a gap, and the gap says "not in an open source".

### 4.2 Licence and terms: flagged risks

| Source | Licence or terms | What we do |
| --- | --- | --- |
| Wikidata | CC0 | use freely; cite the entity URL |
| Wikipedia (lead sentence as a quote) | CC BY-SA | one sentence at most, attributed with the URL as the source; never bulk text |
| SEC EDGAR | public domain; fair-access limits | declared user agent, under 10 requests per second |
| GLEIF | CC0 | use freely |
| arXiv API | metadata CC0 | respect 1 request per 3 seconds |
| OpenCorporates | free tier needs an API key and attribution; bulk use is share-alike | not a default; only if the owner gets a key; flagged **licence risk** |
| Companies House (UK) | OGL, free API key | optional adapter |
| Press articles | copyright | one or two sentences as a quote with publisher and URL; never reproduced wholesale; skip if robots.txt or terms forbid fetching |
| Crunchbase, PitchBook, Tianyancha, Qichacha, LinkedIn | paid or forbids scraping | **never used** |

Every source host is listed in `lib/sources/HOSTS.md` with its terms (existing
file); the new hosts are added in the slice that first uses them.

## 5. The add flow

```bash
pnpm run company:add -- "Physical Intelligence"
pnpm run company:add -- https://www.figure.ai
pnpm run company:add -- --from-proposal <id>
```

Steps (every step reports what it verified and what it could not):

1. **Resolve identity** from the name or URL: Wikipedia search (REST) to a page,
   Wikidata entity for that page (QID, identifiers, HQ country, inception, parent,
   domain), SEC `company_tickers.json` for a ticker and CIK, GLEIF for a LEI, and
   the company's own site for an about sentence (robots.txt checked). Two
   candidates of different entities stop the command and print both; it never
   guesses.
2. **Propose** slug (from the name, deduplicated against registry and `/markets`),
   kind, status and areas from the description and Wikidata industry classes. It
   prints these as proposals; `--areas a,b` and `--kind` override.
3. **Write** `registry/companies/<slug>.json` with evidence only for what was
   verified: a quote that exists on the page it just fetched, with the date. The
   quote is checked as a substring of the fetched text (the same gate
   `scripts/research/add.ts` uses, `verbatimIn`).
4. **Open tasks** for everything else: a `GapTask` per missing frame field (`company:<slug>#registry`), so the research queue picks it up
   (`lib/dossier/demand.ts`).
5. **Validate** the file with the schema and print the path and the live URL.

Result: one new file, `/markets/<slug>` exists the day it merges, and shows the
identity it can prove plus a list of what is unknown. A person can also add the file
by hand; the validator is the same.

Agents (sourcing helpers) follow the same contract: a row without a URL actually
opened and a literal quote and a date does not exist.

## 6. How current pages read from the registry

The change is a seam, not a rewrite. `lib/universe/store.ts` builds the entries
that every page already reads; the registry becomes a second input to it.

| Reader | Today | After |
| --- | --- | --- |
| `/markets/[slug]` | tier A from `MARKET_PARTICIPANTS`, tier B from the universe, tier C stubs | unchanged for those; a registered entity renders as the identity page (tier B component) with its summary, areas, evidence, figures and gaps |
| `/markets/directory` | `directoryRows` over admitted universe entries | the same, plus registered entries; facets gain **area** and **kind** |
| `/data/companies` | the rule and the counts | adds the registry counts: registered by kind, by country, by area; the rule page says "registered or admitted" |
| Chat tools (`company_membership`, exposure) | `whyCompany`, `findUniverseEntry` | `whyCompany` answers **registered** with the evidence; new tools list and compare companies by area and kind, including private labs |
| Search index (`lib/entities`) | tier B companies are an entity source | registered entities are included, same weight (0.8); areas are an entity source too |
| Exposure graph (`lib/company-exposure`) | dependencies by company slug | unchanged: it keys on the slug; a registered company gains edges when a relation is added, as any company does |
| `/areas`, `/areas/[slug]` | none | new (below) |

**Migration, no broken URLs.** (1) A script writes a registry file for each of
the 793 companies the universe admits today, from its slug, name, aliases, ids,
country, themes (mapped to areas) and its `admittedBy` rows (converted to
evidence). Slugs do not change, so no URL moves. (2) A test proves the universe
output is identical before and after: the same slugs, tiers, themes and counts.
(3) Tier A and tier C pages are untouched. (4) The old `universe.json` adapters
continue as proposers. No redirects are needed because no slug changes; where a
registry slug differs from a stub slug (a duplicate), the stub slug redirects with
`permanentRedirect` in the page.

## 7. What customers want to read: prioritised

Institutional investors, analysts, strategists and policymakers ask a few
questions again and again. Ordered by value over effort, each one a view over the
same registry and relation data, each with the evidence rule (no cite, no number):

1. **Market map per area** (areas pages): who is in the area, by kind and country,
   with role, and the gaps. First, because the registry is the product.
2. **Who funds whom**: investors, rounds, strategic stakes and cloud-credit
   deals between labs, cloud, chip and robotics firms, from filings and quoted
   releases. A directed graph with dates.
3. **Compute and capex tracker**: disclosed GPUs, data-centre MW, capex guidance
   by company, from filings and company posts; stated vs reported labelled.
4. **Private valuation ladder**: each private company's rounds in order, with
   date, amount, lead, label and source. Never a current "value".
5. **Supply-chain dependency graph** per product (humanoid, accelerator, frontier
   cluster): the existing exposure model extended to registered companies.
6. **Jurisdictional exposure and sanctions**: entities on the Entity List, SDN,
   1260H and EU lists; export-control touchpoints by company and area.
7. **Talent flows**: moves between labs, from named public announcements and
   papers' affiliations, as dated events.
8. **Timelines**: model releases, plant start-ups, launches, regulatory decisions,
   per area, extending the events model.
9. **Concentration**: who supplies how much of an area (shares only where a source
   prints them).
10. **Change feed**: new registrations, status changes (acquired, defunct),
    refreshed figures; the reason people come back.

## 8. Slices

1. This ADR.
2. Registry schema, validator and loader (tested); `company:add`; migration of the
   793 admitted companies with no output change; the area taxonomy data and the
   `/areas` and `/areas/[slug]` pages.
3. Seed: labs, robotics and their supply chain, then the other areas, each with a
   verified identity row and a gap list. Quality over completeness.
4. Chat tools read the registry.
5. Later, by the list in section 7: the scout, the valuation ladder, the funding graph.

## 9. What this does not do

- It does not price anything. A private company has no quote.
- It does not claim a supply-chain role from being registered. Registered means
  "tracked on purpose"; a role is a cited edge.
- It does not use paid data. A fact only a paid source holds is a gap that says so.
- It does not decide the area tree for the owner; the tree in the repository is the
  proposal and changing it is one file per area.
