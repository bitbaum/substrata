# Substrata

Open-source research on the physical chokepoints between here and a
much faster technological progress.

Live at **https://substrata.orangecat.ch** — that is an address, not an
affiliation. Substrata is its own repository and its own deployment, like the
other sites built here. The subdomain is used
because that apex domain is already owned; it moves to its own domain the day
one is bought.

## Shape

```
config/     the research corpus and the site, as data — the SSOT
            substrata.ts               identity, mandate, phases, disclosure
            substrata-coverage.ts      15 chokepoint materials, 90 producer rows
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
finding. There is no trading desk and nothing here implies one.

## The portal

One shell on every page, signed in or not (`components/shell/`), built from
the pattern Loki and OrangeCat already use rather than a third invention.
The sidebar is five sections grouped by what a reader is doing; only the
section holding the current page opens by itself, so the panel reads as six
lines, not seventeen. Every destination carries a one-line description (the
page's own), shown in the rail's flyouts, the phone's "More" sheet and the
palette.

| Section | Routes |
| --- | --- |
| Explore | `/bottlenecks` · `/atlas` · `/policy` · `/capital` |
| Markets | `/markets` · `/exposure` · `/xray` · `/scenarios` |
| Science | `/science` · `/science/pipeline` · `/learn` |
| Careers | `/careers` · `/careers/paths` · `/careers/companies` |
| News | `/events` · `/notes` |
| Phone tabs | `/bottlenecks` · `/atlas` · `/markets` · `/events` · More |

- **≥1024px**: the full sidebar, collapsible to an icon rail (remembered per
  browser). **768–1023px**: the rail, icon over label; each section opens a
  flyout. **<768px**: four tabs and "More" at the bottom, above the
  safe-area inset; the Ask button sits above the tab bar.
- **Top bar**: search (opens the palette), `Join`, and the account menu.
  Personal pages — Desk, Settings, the reviewer Inbox — and sign-in/out live
  in the account menu, never in the research list.
- **⌘K / Ctrl+K / "/"** opens the command palette: every page (including the
  reader views, data and project pages that have no sidebar row) plus live
  results from the search index; Enter on the last row opens `/search`.
- **Footer**: About, Notes, Changelog, Roadmap, Join, Source, Correction.

`test/nav.test.ts` holds the sections, tabs and this table together and checks
nav contract rules 1, 2 and 6 in the shell's source.

**For you** is one view per reader (`config/audiences.ts`, `app/for/*`):
equity investors, commodity traders, industry teams, job seekers and learners.
Each view only chooses and orders sections of existing screens — X-ray,
exposure, filings, series, events, scenarios, science, careers, learning — and
links each to the full screen; none computes anything of its own. The homepage
opens the same five doors straight under the hero, and the palette lists them
("For equity investors", …).

**Freshness** (`/data/freshness`, `/api/health/freshness`, footer badge): every
scheduled feed (run tables `research_*_runs`) and committed dataset (its own
`checkedOn`/`generatedAt` date) against the cadence or maximum age declared in
`config/substrata-freshness.ts`. `test/freshness.test.ts` fails the build when a
committed dataset is past its maximum age, so stale data cannot be deployed as
current; the endpoint returns 503 when anything is stale or failing. The review
queue is judged on OPEN leads only: a sweep lead nobody reviews within 30 days
(`LEAD_EXPIRY_DAYS`, `lib/lead-expiry.ts`) expires at read time — kept in the
table, listed at `/data/freshness/expired`, out of the queue — so a stale queue
means the expiry or the queue is broken, not that nobody reviewed.

**Data quality** (`/data/quality`, footer link, palette "Quality scores"): every
dataset held to six written criteria — completeness, correctness, provenance,
freshness, link health, consistency — declared in `config/substrata-quality.ts`
(a criterion is a rule or `na` with a reason). Pure checks (`lib/quality/checks-*.ts`:
USGS sums, quote carries the value, names resolve, cross-dataset agreement) run
in `verify` via `test/quality.test.ts`, which ratchets each check's failure count.
Network checks (links with 3 tries, quotes still on the page, SEC ticker file,
OpenFIGI mapping, USGS values on the chapter PDF) run every six hours on a
rotation (`/api/cron/quality`, timer `appcron-substrata-quality`) into
`research_quality_checks`; each run's scorecard goes to `research_quality_runs`
for the trend (`scripts/db/014-quality.sql`). On demand: `pnpm run quality`
(pure), `-- --network` (one slice), `-- --all` (everything), `-- --json out.json`.
No AI anywhere in it.

This table went stale once and cost a redesign: `Megamenu.tsx` was deleted in
7f59e09 and nothing noticed, and what shipped instead hid the whole nav below
1100px — a tablet got a lone "MENU", and a signed-in reader at 834px got no
navigation at all. The sections now live in `config/site-nav.ts` with
`test/nav.test.ts` holding them to this table.

```
config/site-nav.ts              the navigation, as data — sidebar, tabs, sheet and palette render from it
config/substrata-taxonomy.ts    technologies, industries, plain-English lines
config/substrata-policy.ts      instruments, proponents, recommendations
config/substrata-science.ts     candidate reliefs and readiness
config/substrata-join.ts        what expertise this project is short of
content/notes/*.md              the notes, one file each
lib/bottlenecks.ts              the bottleneck join and its list spec
lib/participants.ts             the markets join
lib/notes.ts                    notes and learn, over bip-kit's folder reader
lib/contribute.ts               a join page as a model — portable, see below
lib/labels.ts                   the words the interface uses
components/portal/PublicNav.tsx  the grouped nav, both breakpoints
```

## Notes

`content/notes/<slug>.md`, with frontmatter `title`, `summary`, `publishedAt`,
`author`, `tags`. [bip-kit](https://github.com/bitbaum/bip-kit) parses markdown
into typed blocks and renders them with no raw HTML anywhere, which is what
makes a plain file in the repository safe to publish. Its folder reader
(`readCollection` from `bip-kit/node`) finds, reads and sorts the files;
`lib/notes.ts` adds Substrata's rule that every field is required, so a note
missing one fails the build. `content/learn/*.md` works the same way. The `bp-*` classes are
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

`config/substrata-coverage.ts` is what the firm asserts; the producer-sourcing
engine's finds are a review queue, and the two are kept apart on purpose. A
producer row is sourced or unverified, and only sourced is a finding.

Each engine has ONE queue, in Postgres, filled by a box timer:

| Engine | Timer | Queue | Judgement |
| --- | --- | --- | --- |
| Producer sourcing | `appcron-substrata-source`, every 6 h | `research_source_candidates` | `lib/source.ts` |
| Event sweep | `appcron-substrata-sweep`, hourly (due per `/account/settings#sweep`) | `research_sweep_candidates` | `lib/sweep.ts` |

For each unsourced producer row the sourcing run searches for the company with
the material's keywords, reads the top pages through ai-kit's SSRF-checked
reader, and files a page only if it names the company AND a material term,
with the matching excerpt. Bottleneck pages show those open rows live as
"N found, unchecked"; `/review` lists them. Promotion to "sourced" is a
deliberate edit to the coverage file by someone who read the excerpt.

The sweep does the same per bottleneck for words of change. `/api/events`
reports its last run and open-lead count from the queue. The event record
lists only accepted events: accepting at `/review` publishes the row at once,
and `pnpm run research:accept-events` carries it into
`config/substrata-events-accepted.json` for a commit. The front page also shows
the latest unchecked finds, labelled as not yet checked.

There is no hand-run CLI and no committed worklist any more (removed
2026-09-25): SearXNG is only reachable from the box, and a second queue in git
went stale while the timers ran. To force a run, start the unit on the box:
`sudo systemctl start appcron-substrata-source.service` (or `-sweep`).

Accepting an event means reading the page, taking the date from the page
(search engines rarely supply one) and writing the headline. `config/substrata-assessment.ts` holds each bottleneck's
stage, binding score and horizon; events are what should move them.

## Programmes

`config/substrata-programmes.ts` holds the questions Substrata has set
itself, each layer of a question cross-referenced to rows in
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

## Take it

Bitbaum is a platform for the new economy and for creation: building,
engineering and researching. It's a community of builders, creators and
researchers, and of the people who support them. We work as engineers in the
loop: agents do much of the typing, and people own the judgement.

This code is MIT-licensed so that you can take it. Use it, fork it, rebrand it,
sell it, or lift a single file. Make it yours and keep improving it the way you
like. You don't need to ask, book a call or sign a CLA. Just keep the
[LICENSE](LICENSE) with your copy.

```bash
npx degit bitbaum/substrata my-substrata   # a clean copy without our git history
cd my-substrata && pnpm install
```

- **Needs:** Nothing to start. `.env.example` lists the optional AI keys.
- **Shared pieces:** the `@bitbaum/*` kits install from public npm or public GitHub, so you need no tokens or private registry.

More to take: [orangecat.ch/steal](https://orangecat.ch/steal) and [github.com/bitbaum](https://github.com/bitbaum).

### Want to build it with us? Show us how you think

Copying code is free. What stays scarce once agents and robots write most of
it is seeing the whole system. Pick one of these, in this repo, and open an
issue or a pull request:

1. **Find the second source of truth.** Find a fact this code defines in two
   places. Show how the copies will drift, and say where the one copy should
   live.
2. **Find the silent failure.** Pick a promise this system makes. Find where it
   fails while every check stays green, and propose the check that would catch
   it.
3. **Find where the human belongs.** Point to a step where an agent acts alone
   but a person should decide, or the reverse, and say why.

A short, correct answer beats a long one, and so does an answer that admits
what it doesn't know.
