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

Dated events are the newsfeed. Next: a box timer for `pnpm research:sweep`.
Do not auto-publish unsourced rows.

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
