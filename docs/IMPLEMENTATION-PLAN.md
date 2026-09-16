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

## Self-updating

Dated events are the newsfeed. Next: a box timer for `pnpm research:sweep`.
Do not auto-publish unsourced rows.

## Work log

### 2026-09-16 (quiet chrome)

- Public nav is three links from `PUBLIC_NAV`. Desk sidebar only on account
  and review. Footer is four destinations, not a sitemap.
- Map: Chain | World on `/atlas`. Inquire on thin bottleneck and country pages.

### 2026-09-16 (earlier)

PRs #43–#48: atlas, accounts, coverage, visual chrome, world map, desk, theme.
