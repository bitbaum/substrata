# Substrata

Open-source research on the physical chokepoints between here and a
much faster technological progress.

Live at **https://substrata.orangecat.ch** — that is an address, not an
affiliation. Substrata is its own repository and its own deployment, like the
other sites built here. The subdomain is used
because that apex domain is already owned; it moves to its own domain the day
one is bought, and nothing in this repository changes when it does.

## Shape

```
config/     the research corpus and the site, as data — the SSOT
            substrata.ts               identity, mandate, phases, disclosure
            substrata-coverage.ts      15 chokepoint materials, 92 producer rows
            substrata-participants.ts  101 organisations across 10 chain layers
            substrata-acting.ts        thesis, action routes, readiness ledger
            site-substrata.ts          those objects, rendered as pages
            site-content.ts            the closed set of section shapes
lib/        the site's identity and link helper. The renderers themselves come
            from the shared sitekit package; presentational only, never fetch.
app/        one catch-all route. Pages are data, so adding one is a config entry.
app/globals.css   every design token, and the only place a colour is defined.
```

Nothing on the site is authored twice: the mandate, the coverage universe and
the directory exist once, and the pages are those objects rendered.

Every producer row starts unsourced and renders as unverified, never as a
finding. There is no trading desk and nothing here implies one. Substrata is
built by one person with AI agents; the site says so.

## The portal

Seven destinations, and every section opens the same way: a plain sentence
saying what it is for, four numbers, then a table narrowed by links.

| Route | What it holds |
| --- | --- |
| `/` | Today: what changed in the last 30 days, what is worst now, ways in |
| `/bottlenecks` | Every constraint, grouped by stage, with severity and evidence |
| `/markets` | The organisations that make them, ore to buyer |
| `/policy` | Rules that slow or speed building, and who publicly asked for them |
| `/science` | What would remove a bottleneck, and how far off it is |
| `/research` | The open programme and its questions |
| `/about` | What this is, who makes it, what it is not, and a glossary |

```
config/substrata-taxonomy.ts    technologies, industries, plain-English lines
config/substrata-policy.ts      instruments, proponents, recommendations
config/substrata-science.ts     candidate reliefs and readiness
lib/bottlenecks.ts              the bottleneck join and its list spec
lib/participants.ts             the markets join
lib/labels.ts                   the words the interface uses
components/portal/              shell, board, chips, status — portal-only markup
```

## Nothing untrue

`test/truth.test.ts` walks every string the site can render and fails the build
on phrases that claim a firm this is not: staff, a desk, a schedule, phases,
declining business. Those were all on the site once. Add to that list whenever
a false claim is found; never remove a line without a reason written next to it.

Policy rows carry the date they were fetched, one verbatim sentence from the
source, and whether the source was the issuing body. A company is named as
having asked for a rule only where it says so in its own document.

## Research engine

`research/evidence.json` is what the engine has found; `config/substrata-coverage.ts`
is what the firm asserts. They are kept apart on purpose. A row reads one of
three ways — unverified lead, candidate source, sourced — and only the last is
a finding.

```bash
# The fleet's SearXNG listens on the box's loopback only. From a laptop, tunnel it.
ssh -N -L 8899:127.0.0.1:8899 ubuntu@167.233.22.31 &
SEARXNG_URL=http://127.0.0.1:8899 pnpm research:source            # rows not yet examined
SEARXNG_URL=http://127.0.0.1:8899 pnpm research:source --all      # re-examine everything
SEARXNG_URL=http://127.0.0.1:8899 pnpm research:source --limit 5  # a quick run
```

For each unverified producer row it searches for the company with the
material's keywords, reads the top pages through ai-kit's SSRF-checked reader,
and files a page as a candidate only if it names the company AND a material
term, with the matching excerpt. Promotion to "sourced" is a deliberate edit
to the coverage file by someone who read the excerpt. Commit the evidence file
after a run: git is the timestamp.

## Events and the sweep

`config/substrata-events.ts` holds accepted events: one line, one date, one
source, one effect (tightens / loosens / neutral) on the bottlenecks it names.
`research/events.json` is the sweep's worklist of candidates. The site counts
candidates and lists only accepted events.

```bash
SEARXNG_URL=http://127.0.0.1:8899 pnpm research:sweep             # every bottleneck
SEARXNG_URL=http://127.0.0.1:8899 pnpm research:sweep --limit 5   # a quick run
```

Accepting a candidate means reading the page, taking the date from the page
(search engines rarely supply one), writing the headline, and adding the row
to the accepted file. `config/substrata-assessment.ts` holds each bottleneck's
stage, binding score and horizon; events are what should move them.

## Programmes

`config/substrata-programmes.ts` holds the questions the firm has been
commissioned to answer, each layer of a question cross-referenced to rows in
the coverage universe (a test enforces that every cited row exists), and an
open question is only open if it names what would settle it.

## API

- `GET /api/health` — liveness plus the coverage meter.
- `GET /api/map` — the whole map as one JSON document: materials, producers with
  their three-valued verification and candidate URLs, chokepoints, participants,
  thesis, programmes, readiness. Built from the same config the pages render.

## Development

```bash
pnpm install
pnpm run dev        # http://localhost:3000
pnpm run verify     # format check + type-check + lint + tests
```

## Deployment

Push to `main`. CD is the shared self-host pipeline
(`bitbaum/loki/.github/workflows/selfhost-deploy.yml`), which waits
for this commit's CI, builds, rsyncs to bitbaum and health-checks before
declaring done. Port and hostname come from `scripts/hetzner/apps.conf` in
loki — the SSOT for what runs on the box.
