# Substrata implementation ledger

Started 2026-09-16. Status: beta, visual and desk work in flight on `feat/desk-map-theme`.

## What this site is for

A go-to research service on the physical chokepoints of faster technology.
It should keep itself current, be checkable, and be a pleasure to read on a
train. George reads it; the corpus and the assistant do the gathering.

## Canonical records

Roadmap and changelog are **Loki** (`goals` + `dev_log`), rendered at
`/roadmap` and `/changelog`. Do not author a second copy in TypeScript.
This file is the agent handoff, not the public roadmap.

## Do not reinvent

| Need | Already exists | Do not |
| --- | --- | --- |
| Auth for a studio app | OrangeCat OIDC, same contract as Solon/Heidi (`STACK.md`) | Extract an auth npm package. `SHARED.md`: auth/sessions must not be centralized. Markup is not shareable. |
| Blog / changelog / roadmap rendering | `bip-kit` | A second markdown pipeline |
| AI answers + page reader | `@bitbaum/ai-kit` | A second model client |
| Filters | `listkit` | A second URL codec |
| Site as data | `sitekit` | A second section schema |
| Artist sites (Annushka, s-ink / sinktattoo) | Their own sites | Changelog, roadmap, vision. They are not tech products. Leftover Astra files were discarded 2026-09-16. |

The account **desk UI** stays in this repo. Share the OrangeCat OIDC *decision*,
assert it locally. If a second studio app needs the same desk, extract
behaviour then, not markup.

## Now building

1. **Visible changelog** — header “Log”, homepage teaser, timeline layout. Was
   buried in Latest and looked like a single blob.
2. **Desk** — Grok-like signed-in shell: left sidebar, avatar dropdown, saved
   technologies, news on those rails, Ask. OrangeCat sign-in, not a new IdP.
3. **SpaceX-like visual system** — geometric sans, black/white, dark / light /
   auto (`prefers-color-scheme` + stored override). No serif journal look.
4. **World map** — `/world`, every country, paint = recorded coverage. Policy,
   organisations, events, materials. EU rules colour member states.
5. **Self-updating corpus** — dated events already are the newsfeed. Next:
   box timer for `pnpm research:sweep` (and later sourced promotion), so the
   map moves without a session. Do not auto-publish unsourced rows.

## Acceptance

- `/changelog` reachable in one click from the header on desktop and from the
  mobile menu.
- Signed-out: avatar menu offers OrangeCat sign-in and theme.
- Signed-in: sidebar + desk with followed technologies.
- `/world` paints countries we have records for; a country with nothing says so.
- Theme auto/dark/light survives reload without a flash.
- Annushka and s-ink have no changelog/roadmap leftovers.

## Work log

### 2026-09-16 (later)

- Discarded uncommitted changelog/roadmap files on Annushka and s-ink.
- Started `feat/desk-map-theme`: tokens, theme boot, avatar menu, desk
  sidebar, world map, changelog in the header, desk dashboard.
- Auth stays OrangeCat OIDC. No new GitHub package.

### 2026-09-16 (earlier)

See git history for PRs #43–#47 (atlas, accounts, coverage, visual chrome).
