# Data entry — the prompt for a data agent

A cheaper model adds ONE facet of data to Substrata per session, as candidate
rows. It never edits TypeScript; it writes a JSON array and runs one script,
`scripts/research/add.ts`, which is the gate. Rows it adds read "Candidate
source" on the site until a person promotes them. Decided in
`docs/architecture/2026-10-23-knowledge-system.md`, §3.

## The prompt

Give the data agent this, with `<facet>` and the task filled in:

```
You add ONE facet of data to Substrata. You may write only a JSON array for `scripts/research/add.ts <facet>`.
You may not edit config/*.ts, lib/, or tests. You may not write evidence other than "candidate".
Every row: a primary source URL (publisher, regulator, company filing, USGS/IAEA/EIA table), a quote of
20–400 characters copied verbatim from that page, readOn = today, asOf = the date the fact is FOR.
submittedBy.model is "unrecorded": never write a model name or id into a row.
Numbers: value + unit + year + basis ('reported'|'estimated'); never a bare number. No share, rank or
"largest" words — those are computed. If a source is paywalled or you cannot quote it, omit the row
and list it under "skipped" with the reason. Shape: `add.ts <facet> --schema`.
Run `add.ts --dry-run` and fix every exit code before opening the PR.

Task: <one line: what to add, for which bottlenecks / countries / companies — or a task's `instruction` from scripts/research/gaps.ts>.
```

## Working from a task

Usually you are handed one task from the work queue rather than a free-form
line. The queue is every empty or thin box of every dossier (country, company,
resource, lab), computed from the rows that exist (`lib/dossier`):

```bash
# The next ten tasks, in the order the owner wants them done.
pnpm exec tsx scripts/research/gaps.ts --limit 10
# One country, one box, or one kind; --out also writes the JSON to a file.
pnpm exec tsx scripts/research/gaps.ts --entity country:kz --box facilities
pnpm exec tsx scripts/research/gaps.ts --kind company --out tasks.json
```

Each task is a JSON record. Read these fields and nothing else decides what you do:

| field | what you do with it |
| --- | --- |
| `missing` | the one sentence you are closing |
| `href` | open it first; never add a row the page already shows |
| `allowedSources` | look ONLY in these source families, in this order |
| `writeTo` | the facet and file your rows go to; `add.ts <facet> --schema` gives the shape |
| `example` | the shape of a good row. Its quote is a placeholder: copy yours from the page |
| `blockedBy` | when set, write nothing: report `skipped` with that reason and stop |
| `instruction` | all of the above as one block, ready to paste under the prompt |

Then it is the same gate as always: write the rows, run `add.ts <facet> rows.json
--dry-run` until it exits 0, run it without `--dry-run`, open the PR. Your rows are
candidates: until a person promotes them the task stays in the queue and says
"N candidate rows wait for review", because candidate rows never fill a box. Do not try to make a
box "full" by adding weak rows: a lead, a guess or an inferred share is never a row.

The source may be an HTML page, a JSON API response or a **PDF** (annual
reports, NI 43-101 technical reports, yearbooks). For a PDF, copy the sentence
as it reads on the rendered page: the gate forgives line breaks and a word
hyphenated across a line end, nothing else, and prints the page it found the
quote on (`ok <key> (page 17)`). Put that page in `source.locator`
("page 17"). A scanned PDF with no text layer cannot be quoted: report the row
as "skipped" (reason: "scan, no text").

## The adapter workflow — do this first for every task

Some boxes have a **source adapter** (`lib/sources/README.md`): a script that
reads a free registry or filing — UN Comtrade, SEC EDGAR, GLEIF, Wikidata,
Kazatomprom's reports — and proposes candidate rows with their quotes already
cut from the fetched text. Your job is then to check, not to type. In order:

1. **Run the task in dry run.** It prints the instruction, the allowed
   sources, and every adapter's proposed rows and skipped records:

   ```bash
   pnpm exec tsx scripts/research/run-task.ts country:kz#trade --out rows.json
   ```

2. **If an adapter says `not run: pass --lei …` (or `--qid`, `--cik`)**, list
   the candidates and choose only when exactly one is plainly the subject (same
   legal name, same country). If none or several fit, do not choose: report it.

   ```bash
   pnpm exec tsx scripts/research/run-task.ts --find-lei "Shin-Etsu Handotai"
   pnpm exec tsx scripts/research/run-task.ts company:shin-etsu-handotai#owners --lei 353800AARAPM3AYH4I04
   ```

3. **Read every proposed row against its quote.** Each says whether it
   `fills this box` or is `related; does not fill this box`. Delete from
   rows.json any row whose quote does not say what the row says; never edit a
   quote, a grade or a number to make it fit. A `lead` stays a lead.

4. **Gate them**: `pnpm exec tsx scripts/research/add.ts relations rows.json --dry-run`,
   then the same with `--branch` (or `run-task.ts … --write`, which runs the
   same add.ts with every check). Rows carry `provenance` (which adapter, when,
   which URL), `submittedBy.model: "deterministic-adapter"` and sometimes a
   `note` (what a figure measures, why a row is a lead) — leave them as they are.

   **Leads are not written by default.** The dry run prints `lead because: …`
   under every lead, and `rows.json` and `--write` hold only `stated` rows.
   Pass `--include-leads` only when the task asks for leads; a lead never fills
   a box. A row already in the corpus or the sidecar is skipped — a trade flow
   is matched by from, type, to, asOf and HS code, not by its wording — so
   re-running a task proposes only what is new.

5. **Then the box by hand** for whatever the adapters skipped, from the task's
   allowed sources, with the normal rules below.

6. **Paste the closing list into the PR description.** `run-task.ts` ends with
   `--- paste into the PR description ---` and a plain-text list: the rows
   written (or proposed, on a dry run) and every row skipped with its reason
   ("regions are not entities", "a lead, not written without
   --include-leads: …", "already in the corpus"). Paste it as it stands: it is
   the reviewer's checklist and the next person's starting point.

Comtrade rows: the quote is the raw record from `"reporterCode"` through
`"netWgt"` (reporter, partner and weight are M49 codes; the locator names the
countries). The weight is the mass of the goods declared under the HS code —
for HS 2844 the uranium compound, not uranium content — and the row's `note`
and `volume.commodity` say so. Never restate it as tonnes of uranium.

## When a box cannot be filled honestly

Say so, and stop. Report the task `skipped` with one line of reason ("the only
source is paywalled", "the registry names a region, not a country", "no
primary source states the buyer"). Do NOT force the fact into another facet
or relation type to get a row in — a buyer that is only a region is not a
`ships_to` to a country, a delivery point is not a buyer, a share you
computed is not a stated share. An empty box with a true reason is a better
result than a full one with a bent row.

When `run-task.ts` says no adapter covers the box, work it by hand from the
task's `instruction`, as below.

## Run it

From the repository root, on a fresh branch off `main`:

```bash
# 1. Read the shape for your facet.
pnpm exec tsx scripts/research/add.ts <facet> --schema

# 2. Write your rows to rows.json, then check them without writing anything.
pnpm exec tsx scripts/research/add.ts <facet> rows.json --dry-run

# 3. When the dry run exits 0, add them and commit on data/<facet>-<key>.
pnpm exec tsx scripts/research/add.ts <facet> rows.json --branch

# 4. Prove the corpus still holds, then push and open the PR with the body step 3 printed.
pnpm test
```

`-` in place of `rows.json` reads the rows from stdin.

| exit | means | do |
| --- | --- | --- |
| 0 | every row passed (and, without `--dry-run`, was appended sorted) | open the PR |
| 1 | usage: unknown facet or no input | fix the command |
| 2 | a row does not match the schema | read the printed path and message, fix the row |
| 3 | the source page could not be read | find a readable page, or move the row to "skipped" |
| 4 | the quote is not word for word on the page | copy the sentence again from the page, exactly |
| 5 | the row is already in the corpus or the sidecar | drop it — it is done |

Facets: `producers`, `events`, `endowments`, `facilities`, `instruments`,
`science`, `ownership`, `series-points`, `relations`. A relation's endpoints
are entity ids (`company:asml`, `country:kz`) that the site or
`research/usgs-relations.json` already names; see `lib/graph/README.md`. Rows land in
`config/candidates/<facet>.json`; `test/candidates.test.ts` re-checks every
row in CI.

## The shapes

Printed by `add.ts <facet> --schema` (`--json-schema` gives the same as JSON
Schema). Every name a row uses — a bottleneck, a company, a country, a series —
must already exist on the site; the gate checks.

### `producers`

```ts
{
  evidence: "candidate";
  asOf: string; // /^\d{4}(-\d{2}(-\d{2})?)?$/; The date the fact is FOR, at the precision the source gives.
  source: {
    url: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
    quote: string; // 20–400 chars; Copied VERBATIM from the page at url. The gate re-reads the page and looks for it.
    readOn: string; // /^\d{4}-\d{2}-\d{2}$/; The day you read the page: today.
  };
  submittedBy: {
    agent: string; // 1–∞ chars; Who ran it, e.g. "data-agent".
    model: string; // 1–∞ chars; Write "unrecorded": repo files never name the model that ran. Adapters write "deterministic-adapter".
    runId: string; // 1–∞ chars; One id per session, the same on every row it writes.
  };
  material: string; // The material NAME the producer row sits under, e.g. "Gallium, refined".
  name: string; // 2–∞ chars; Company name as it trades.
  jurisdictions: string[]; // /^[A-Z]{2}$/
  role: "mine" | "refine" | "convert" | "recycle";
  aliases?: string[]; // 2–∞ chars
}
```

### `events`

```ts
{
  evidence: "candidate";
  asOf: string; // /^\d{4}(-\d{2}(-\d{2})?)?$/; The date the fact is FOR, at the precision the source gives.
  source: {
    url: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
    quote: string; // 20–400 chars; Copied VERBATIM from the page at url. The gate re-reads the page and looks for it.
    readOn: string; // /^\d{4}-\d{2}-\d{2}$/; The day you read the page: today.
  };
  submittedBy: {
    agent: string; // 1–∞ chars; Who ran it, e.g. "data-agent".
    model: string; // 1–∞ chars; Write "unrecorded": repo files never name the model that ran. Adapters write "deterministic-adapter".
    runId: string; // 1–∞ chars; One id per session, the same on every row it writes.
  };
  id: string; // /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/
  date: string; // /^\d{4}-\d{2}-\d{2}$/; The day it happened or was announced. asOf is the same day.
  headline: string; // 1–120 chars
  kind: "capacity" | "lead-time" | "price" | "policy" | "outage" | "filing" | "milestone";
  effect: "tightens" | "loosens" | "neutral";
  bottlenecks: string[]; // A bottleneck NAME exactly as the site spells it, e.g. "Gallium, refined".
  participants: string[];
  jurisdictions: string[]; // /^[A-Z]{2}$/
  primary: boolean; // True when the source is the organisation's own page or record.
}
```

### `endowments`

```ts
{
  evidence: "candidate";
  asOf: string; // /^\d{4}(-\d{2}(-\d{2})?)?$/; The date the fact is FOR, at the precision the source gives.
  source: {
    url: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
    quote: string; // 20–400 chars; Copied VERBATIM from the page at url. The gate re-reads the page and looks for it.
    readOn: string; // /^\d{4}-\d{2}-\d{2}$/; The day you read the page: today.
  };
  submittedBy: {
    agent: string; // 1–∞ chars; Who ran it, e.g. "data-agent".
    model: string; // 1–∞ chars; Write "unrecorded": repo files never name the model that ran. Adapters write "deterministic-adapter".
    runId: string; // 1–∞ chars; One id per session, the same on every row it writes.
  };
  material: string; // /^[a-z0-9-]+$/; A bottleneck SLUG, e.g. "gallium-refined" (the last part of /bottlenecks/<slug>).
  stage: "mine" | "refine" | "convert";
  describes?: string; // What the figure literally counts, if narrower.
  place: string; // /^[a-z]{2}$/; Lower-case ISO 3166-1 alpha-2 of a country entity, e.g. "ne".
  production?: {
    value: number; // 0..∞
    unit: "kg" | "t" | "Mcm" | "bcm";
    year: integer; // 1900..2100; The year the figure describes.
    basis: "reported" | "estimated" | "withheld";
  };
  reserves?: {
    value: number; // 0..∞
    unit: "kg" | "t" | "Mcm" | "bcm";
    year: integer; // 1900..2100; The year the figure describes.
    basis: "reported" | "estimated" | "withheld";
  };
  note?: string;
}
```

### `facilities`

```ts
{
  evidence: "candidate";
  asOf: string; // /^\d{4}(-\d{2}(-\d{2})?)?$/; The date the fact is FOR, at the precision the source gives.
  source: {
    url: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
    quote: string; // 20–400 chars; Copied VERBATIM from the page at url. The gate re-reads the page and looks for it.
    readOn: string; // /^\d{4}-\d{2}-\d{2}$/; The day you read the page: today.
  };
  submittedBy: {
    agent: string; // 1–∞ chars; Who ran it, e.g. "data-agent".
    model: string; // 1–∞ chars; Write "unrecorded": repo files never name the model that ran. Adapters write "deterministic-adapter".
    runId: string; // 1–∞ chars; One id per session, the same on every row it writes.
  };
  id: string; // /^[a-z0-9-]+$/
  name: string; // 2–∞ chars
  kind: "field" | "plant" | "mine" | "refinery" | "fab";
  place: string; // /^[a-z]{2}$/; Lower-case ISO 3166-1 alpha-2 of a country entity, e.g. "ne".
  where: string; // 2–∞ chars; Where in the country, in words.
  operator: string | null;
  makes: string[]; // /^[a-z0-9-]+$/; A bottleneck SLUG, e.g. "gallium-refined" (the last part of /bottlenecks/<slug>).
  what: string; // 10–∞ chars; What the source actually says about it, in one line.
  primary: boolean;
}
```

### `instruments`

```ts
{
  evidence: "candidate";
  asOf: string; // /^\d{4}(-\d{2}(-\d{2})?)?$/; The date the fact is FOR, at the precision the source gives.
  source: {
    url: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
    quote: string; // 20–400 chars; Copied VERBATIM from the page at url. The gate re-reads the page and looks for it.
    readOn: string; // /^\d{4}-\d{2}-\d{2}$/; The day you read the page: today.
  };
  submittedBy: {
    agent: string; // 1–∞ chars; Who ran it, e.g. "data-agent".
    model: string; // 1–∞ chars; Write "unrecorded": repo files never name the model that ran. Adapters write "deterministic-adapter".
    runId: string; // 1–∞ chars; One id per session, the same on every row it writes.
  };
  id: string; // /^[a-z0-9-]+$/
  jurisdiction: "us" | "eu" | "cn" | "jp" | "kr" | "tw" | "nl" | "gb" | "de" | "ch";
  title: string; // 3–∞ chars
  body: string; // 2–∞ chars; The issuing body, as it names itself.
  kind: "export-control" | "licence-regime" | "compute-threshold" | "tariff" | "safeguard" | "permit" | "procedure" | "subsidy" | "standard";
  status: "proposed" | "consulted" | "adopted" | "in-force" | "withdrawn";
  statusNote?: string;
  date: string; // /^\d{4}-\d{2}-\d{2}$/
  effect: "tightens" | "loosens" | "mixed";
  summary: string; // 10–∞ chars
  technologies: ("ai" | "robotics" | "energy" | "manufacturing" | "space")[];
  industries: ("semiconductors" | "power-grid" | "mining-materials" | "gases-chemicals" | "data-centres" | "machinery")[];
  bottlenecks: string[]; // A bottleneck NAME exactly as the site spells it, e.g. "Gallium, refined".
  primary: boolean;
  proponents: {
    name: string;
    asked: string;
    source: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
  }[];
}
```

### `science`

```ts
{
  evidence: "candidate";
  asOf: string; // /^\d{4}(-\d{2}(-\d{2})?)?$/; The date the fact is FOR, at the precision the source gives.
  source: {
    url: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
    quote: string; // 20–400 chars; Copied VERBATIM from the page at url. The gate re-reads the page and looks for it.
    readOn: string; // /^\d{4}-\d{2}-\d{2}$/; The day you read the page: today.
  };
  submittedBy: {
    agent: string; // 1–∞ chars; Who ran it, e.g. "data-agent".
    model: string; // 1–∞ chars; Write "unrecorded": repo files never name the model that ran. Adapters write "deterministic-adapter".
    runId: string; // 1–∞ chars; One id per session, the same on every row it writes.
  };
  id: string; // /^[a-z0-9-]+$/
  name: string; // 2–∞ chars
  front: "ai" | "robotics" | "energy" | "manufacturing" | "space";
  industries: ("semiconductors" | "power-grid" | "mining-materials" | "gases-chemicals" | "data-centres" | "machinery")[];
  plain: string; // 10–∞ chars
  relieves: {
    bottleneck: string; // A bottleneck NAME exactly as the site spells it, e.g. "Gallium, refined".
    mechanism: string; // 5–∞ chars
  }[];
  readiness: integer; // 1..9
  readinessWhy: string; // 5–∞ chars
  nextMilestone: string | null;
}
```

### `ownership`

```ts
{
  evidence: "candidate";
  asOf: string; // /^\d{4}(-\d{2}(-\d{2})?)?$/; The date the fact is FOR, at the precision the source gives.
  source: {
    url: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
    quote: string; // 20–400 chars; Copied VERBATIM from the page at url. The gate re-reads the page and looks for it.
    readOn: string; // /^\d{4}-\d{2}-\d{2}$/; The day you read the page: today.
  };
  submittedBy: {
    agent: string; // 1–∞ chars; Who ran it, e.g. "data-agent".
    model: string; // 1–∞ chars; Write "unrecorded": repo files never name the model that ran. Adapters write "deterministic-adapter".
    runId: string; // 1–∞ chars; One id per session, the same on every row it writes.
  };
  company: string; // /^[a-z0-9-]+$/; A directory company SLUG (the last part of /markets/<slug>).
  status: "listed" | "private" | "subsidiary" | "state-owned";
  parent?: string;
  ownedBy?: string;
  name: string; // 2–∞ chars; The holder, as the document names it.
  share: number | null; // Per cent, read off the document; null when the document names no figure.
  kind: "founder" | "state" | "fund" | "strategic" | "public-float";
  note?: string;
}
```

### `series-points`

```ts
{
  evidence: "candidate";
  asOf: string; // /^\d{4}(-\d{2}(-\d{2})?)?$/; The date the fact is FOR, at the precision the source gives.
  source: {
    url: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
    quote: string; // 20–400 chars; Copied VERBATIM from the page at url. The gate re-reads the page and looks for it.
    readOn: string; // /^\d{4}-\d{2}-\d{2}$/; The day you read the page: today.
  };
  submittedBy: {
    agent: string; // 1–∞ chars; Who ran it, e.g. "data-agent".
    model: string; // 1–∞ chars; Write "unrecorded": repo files never name the model that ran. Adapters write "deterministic-adapter".
    runId: string; // 1–∞ chars; One id per session, the same on every row it writes.
  };
  series: string; // The id of a committed series in research/series.json.
  date: string; // /^\d{4}(-Q[1-4]|-\d{2}(-\d{2})?)?$/; The period the value is FOR.
  value: number;
  low?: number; // Only when the source states a range: its lower end.
  publisher: string; // 2–∞ chars
  published?: string; // /^\d{4}-\d{2}-\d{2}$/
  primary: boolean;
  note?: string;
}
```

### `relations`

```ts
{
  evidence: "candidate";
  asOf: string; // /^\d{4}(-\d{2}(-\d{2})?)?$/; The date the fact is FOR, at the precision the source gives.
  source: {
    url: string; // /^https?:\/\/\S+$/; The primary source page — publisher, regulator, filing, agency table.
    quote: string; // 20–800 chars; Copied VERBATIM from the page at url. The gate re-reads the page and looks for it. At most 400 characters by hand; only an adapter's record (with provenance) may run longer.
    readOn: string; // /^\d{4}-\d{2}-\d{2}$/; The day you read the page: today.
  };
  submittedBy: {
    agent: string; // 1–∞ chars; Who ran it, e.g. "data-agent".
    model: string; // 1–∞ chars; Write "unrecorded": repo files never name the model that ran. Adapters write "deterministic-adapter".
    runId: string; // 1–∞ chars; One id per session, the same on every row it writes.
  };
  from: string; // /^(bottleneck|company|science|policy|country|capital|loop|facility|talent|learn|article):[a-z0-9-]+$/; Who or what the relation starts from, as an entity id.
  to: string; // /^(bottleneck|company|science|policy|country|capital|loop|facility|talent|learn|article):[a-z0-9-]+$/; Who or what it points to, as an entity id.
  type: "operates" | "owns" | "finances" | "supplies" | "buys_from" | "ships_to" | "licenses" | "regulates" | "researches" | "employs" | "competes_with";
  grade: "stated" | "lead"; // "stated" when the quote says it outright; "lead" when it only suggests it.
  share?: {
    value: number; // 0..100
    unit: "percent";
  };
  volume?: {
    value: number;
    unit: string; // 1–∞ chars
    period: string; // 1–∞ chars
    commodity?: string;
  };
  note?: string; // 1–300 chars; What a reviewer must know to read the quote: what a figure measures, or why the row is only a lead. Never a fact the quote does not carry.
}
```

<!-- BEGIN: labs facet and stub companies (lab entity kind) -->

## Labs, and companies known only from the sources

This block is maintained with the `lab` entity kind
(`config/substrata-labs.ts`, `lib/entry/lab-schema.ts`). It sits at the end of
the file on purpose; the sections above are edited separately.

### `labs` — an institute, university group or national laboratory

A **lab** is an organisation that researches or trains people for a tracked
bottleneck. It fills the country dossier's *People and labs* box and its own
four boxes (what it works on, where, how to join, funding). One row per lab:

```bash
pnpm exec tsx scripts/research/add.ts labs --schema
pnpm exec tsx scripts/research/add.ts labs rows.json --dry-run
```

- **Source**: the lab's own page (or its university's) is best; a national
  research funder's award list or a paper's affiliation line is next. The quote
  must say what the lab works on — copy it verbatim.
- **`worksOn`**: one entry per bottleneck the quote supports, by the site's
  bottleneck NAME (`"Uranium conversion and enrichment"`). `what` is the line of
  work in the source's own terms. No bottleneck the source does not support.
- **`place`** is the lower-case country code; **`where`** only when the page
  says (a city, a campus). **`url`** is the lab's own page.
- **`join`** is a page where someone applies — a vacancy board, a doctoral or
  fellowship programme — or `null`. Never a general contact page.
- **No funding field.** A funder is a `finances` relation into `lab:<id>`
  (`add.ts relations`), with its own quote naming the funder; the lab page shows
  only those stated rows. Write the lab row first: the relation's endpoint must
  exist.
- `id` is a slug of the name as the lab writes it. A second row with the same
  `id` exits 5.

```ts
{
  // …the common part: evidence, asOf, source { url, quote, readOn, locator? }, submittedBy
  id: string; // a slug of the name, e.g. "institute-of-nuclear-physics-almaty"
  name: string; // as the lab writes it on its own page
  type: "institute" | "university-group" | "national-lab";
  place: string; // lower-case ISO 3166-1 alpha-2, e.g. "kz"
  where?: string; // city or campus, only when the source says
  worksOn: { bottleneck: string; what: string }[]; // at least one
  url: string; // the lab's own page
  join: string | null; // where someone applies, or null
}
```

### Companies the site names but does not profile (stubs)

Every operator or owner the USGS yearbook tables print — NAC Kazatomprom JSC,
JV Inkai LLP, Uranium One Inc. — now has a page at `/markets/<slug>` that lists
only the relations naming it ("We hold no profile for this company yet").
These **stub companies** come from the relation graph at build time; you never
write one. What changes for you:

- An **event** may name a stub as a participant, by its name exactly as the
  page prints it (`"NAC Kazatomprom JSC"`; not the reviewed alias spelling
  `"NAC Kazatomp JSC"`).
- A **relation** may use a stub's id as an endpoint (`company:nac-kazatomprom-jsc`),
  including the holders the corpus's ownership rows name (`company:blackrock`).
  Relation endpoints may also be `lab:<id>` once the lab row exists.
- A stub is not in the directory: the `companySlug` and `companyName` fields
  (ownership, facility operator) still take directory companies only. To give a
  stub a profile, add a `producers` row for it with its source.

<!-- END: labs facet and stub companies -->
