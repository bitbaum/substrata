# Substrata implementation ledger

Started 2026-09-16. Status: quiet-chrome in flight.

## What this site is for

A go-to research service on the physical chokepoints of faster technology.
George reads it; the corpus and the assistant do the gathering. It should
look and work like Loki/OrangeCat where they already solved a problem:
OrangeCat OIDC, `@bitbaum/ai-kit` for answers and web reads, `listkit` for
filters, `bip-kit` for notes. Markup stays in this repo.

## Chrome (first principle)

A reader is doing one of two jobs.

1. **Public** — read the research. SpaceX-thin bar: Map, News, Ask, search,
   account. Footer is legal + About / Changelog / Roadmap / Source. No
   sidebar. No megamenu. No sitemap.
2. **Desk** (`/account`, `/review`) — operate. Sidebar from `DESK_NAV`. No
   public megamenu. No fat footer.

Header + footer + sidebar on the same page is a bug. Sidebar on the homepage
is a bug.

Atlas and World are one map with two views (`/atlas`, `/atlas?view=world`).
`/world` redirects. Geography and chain are projections of the same corpus.

## Do not reinvent

| Need | Already exists | Do not |
| --- | --- | --- |
| Auth | OrangeCat OIDC (`STACK.md`) | An auth npm package |
| AI answers + page reader | `@bitbaum/ai-kit` (`lib/chat.ts`, `scripts/research/*`) | A second model client |
| Filters | `listkit` | A second URL codec |
| Notes | `bip-kit` | A second markdown pipeline |
| Nav lists | `config/site-nav.ts` | Hardcoded links in Shell |

## Gaps a stranger can fill

`Inquire` posts to `/api/contributions` (existing inbox, rate-limited, not
published). Use it wherever a row is thin or empty. GitHub correction remains
for sourced errors.

## Packages in this layer

- Chat engine: `@bitbaum/ai-kit` `complete()` + grounding — same as Cat/Loki.
  The UI is not a shared package (`SHARED.md`). Substrata's companion is a
  thread that *calls* that engine. Health exposes `ai: configured`.
- Comments: `threadkit` (permission is participation). Storage is Postgres
  `research_page_messages`. AI fact-check is an `ai` participant.
- Map: `react-simple-maps` (Equal Earth), not a hand-projected SVG.

## Companion (Ask)

Uses `@bitbaum/ai-kit` `complete()` + `ai-kit/grounding`. Retrieval is local
corpus + country directory + graph neighbours. UI is a thread (Grok-like),
not a form. Contribute stays a separate inbox path.

**ai-kit is the right package.** Keep using it. Gaps worth a package PR later,
not a second client:

- no streaming/`onToken` on `complete()` — Substrata waits for the full
  answer, then paints the turn. Fake token drip would be dishonest.
- no RAG helper — retrieval stays app-side (the corpus is ours).
- no chat UI package — `SHARED.md`: do not centralise markup. OrangeCat's
  ModernChatPanel is Cat-specific (tools, memory, quota). Do not copy it.

## Graph, institutions, and what is not faked

The corpus is still **files** (SSOT). `lib/graph.ts` + `GET /api/graph` is the
join. A graph database (Postgres recursive edges, or Neo4j later) is the next
store — do not copy facts into a second database until the query surface is
stable.

**Not in this pass, on purpose:**
- Bloomberg prices / analyst consensus — needs a licensed feed. Ticker
  directory can land; numbers cannot be invented.
- Job scraping — schema on talent, rows only with a public posting URL.
- Newsletters — `mail-kit` + Listmonk for bulk. Follow lists are the
  personalisation substrate (`research_preferences`).

## Self-updating

Dated events are the newsfeed. A systemd timer on the box now drives BOTH
engines through authenticated cron routes rather than a human running the
CLI: `POST /api/cron/sweep` (events, `lib/sweep-store.ts`, four times a day)
and `POST /api/cron/source` (producer sourcing, `lib/source-store.ts`, added
2026-09-21). Neither auto-publishes: findings land in a Postgres review
queue (`research_sweep_candidates` / `research_source_candidates`) and
`/review` is where a person decides, exactly as the CLI scripts already
required a person to read an excerpt before promoting it. The judgement each
engine runs on — what counts as an event, what counts as a source match —
lives once in `lib/sweep.ts` / `lib/source.ts` so the timer and the hand-run
script cannot quietly disagree about what they are looking for.

Two manual steps land this, same as `003-sweep.sql` before it: apply
`scripts/db/004-source-sweep.sql` via `scripts/provision-service.py` on the
box, and add `/api/cron/source` to whatever schedule
`/opt/_appcron/run.sh` already runs `/api/cron/sweep` on. The generic deploy
workflow does not do either automatically.

A second, independent leg needs neither of those: `.github/workflows/research-sweep.yml`
runs both CLI scripts on a weekly GitHub Actions schedule against a Brave or
Tavily key (repository secret — `BRAVE_SEARCH_API_KEY` / `TAVILY_API_KEY`,
skips cleanly until one is set) and opens a draft PR with whatever lands in
`research/evidence.json` / `research/events.json`. No box access, no
migration, no `_appcron` registration — the CLI scripts already write into
those git-tracked files when a person runs them, so the workflow only adds
the timer. A draft PR because the fleet's auto-merge sweep leaves drafts
alone, and nobody has read these rows yet.

## Work log

### 2026-09-16 (every country)

- 177 landmasses indexed (`config/substrata-countries.ts`, generated).
- Geology directory + extra endowments so most producing states are not blank.
- Resource → bottleneck auto-links (lithium → chemicals, uranium → fuel cycle).
- World view: resource filter, coverage counts, similar geologies, SVG of
  connected records. Ask is a link, not the only way in.

### 2026-09-16 (country dossiers)

- Every country on the map is a dossier: geology directory + related
  bottlenecks + corpus rows + graph neighbours. Niger is uranium. Argentina is
  lithium. Grey is a gap you can still open.
- New unverified leads: lithium chemicals, uranium fuel cycle, metal AM
  machines, SMR licensing.
- Derived graph API: `/api/graph?kind=country&id=ne`.

### 2026-09-16 (restore destinations)

- RESEARCH_NAV is the SSOT: Map, Bottlenecks, Markets, Policy, Science,
  Capital, Learn, News, Talent. Public bar and desk sidebar share it.
- Signed-in chrome keeps the sidebar on every page except the homepage, so
  clicking a left-panel item does not drop the reader into a different shell.
- Ask is a bottom-right dock on every page except `/chat` (ai-kit).
- Added JBIC (sourced), two Learn notes, two Science leads marked unsourced.

### 2026-09-16 (quiet chrome)

- Atlas and world remain one map with two views. Inquire stays on thin pages.

### 2026-09-16 (earlier)

PRs #43–#48: atlas, accounts, coverage, visual chrome, world map, desk, theme.
