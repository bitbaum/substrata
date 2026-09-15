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

Three menu groups and one action, because seven flat items was more than a
reader could hold. Every destination carries a one-line description in the
menu, so a reader chooses from what they will find rather than from a noun.

| Group | Routes |
| --- | --- |
| The map | `/bottlenecks` · `/markets` · `/policy` · `/science` |
| Latest | `/` (Today) · `/events` · `/notes` |
| About | `/about` · `/thesis` · `/research` · `/api/map` |
| Action | `/join` |

```
config/site-nav.ts              the navigation, as data — both menus render from it
config/substrata-taxonomy.ts    technologies, industries, plain-English lines
config/substrata-policy.ts      instruments, proponents, recommendations
config/substrata-science.ts     candidate reliefs and readiness
config/substrata-join.ts        what expertise this project is short of
content/notes/*.md              the notes, one file each
lib/bottlenecks.ts              the bottleneck join and its list spec
lib/participants.ts             the markets join
lib/notes.ts                    the listing layer over bip-kit
lib/contribute.ts               a join page as a model — portable, see below
lib/labels.ts                   the words the interface uses
components/portal/Megamenu.tsx  grouped nav, no JavaScript in either breakpoint
```

## Notes

`content/notes/<slug>.md`, with frontmatter `title`, `summary`, `publishedAt`,
`author`, `tags`. [bip-kit](https://github.com/bitbaum/bip-kit) parses markdown
into typed blocks and renders them with no raw HTML anywhere, which is what
makes a plain file in the repository safe to publish. It ships no filesystem
layer on purpose, so `lib/notes.ts` is the listing half. The `bp-*` classes are
dressed in this site's tokens in `app/globals.css` — the package owns the
parsing, this repo owns every visual decision.

Publishing a note is adding a file and committing it.

## Reusing the join page in another project

`lib/contribute.ts` has no imports from this project. It is a typed model plus
a pure function to sitekit sections, and it enforces the one rule that matters:
an invitation to contribute is not an offer of employment, so `terms` is
required and renders above the ask.

To use it elsewhere: copy that file, write your own `ContributeModel`, render it
into a sitekit page. `validateContribute()` returns the problems so the project
can fail its own build rather than publish a page that implies a job.

It is deliberately not a package yet. The fleet's rule is that a shared package
earns a dependency when it removes a decision you keep re-making, and markup is
not shareable in any case. When a third project wants this, the file lifts into
sitekit unchanged and the copies become an import.

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
