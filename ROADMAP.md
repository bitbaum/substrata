# Roadmap

Substrata writes down, in public, the physical bottlenecks between here and much faster technology. This is the order the work is being done in, and why. Nothing here is dated: the order carries the argument. Planned things are written as plans; nothing is presented as shipped before it is.

This file is what the fleet map (`loki.orangecat.ch/api/fleet/map`) reads, and `/roadmap` on the site renders from the map. The reasoning behind the order lives in `docs/CONCEPT.md` (§9, "Order of work").

## Now

### Every producer row sourced or gone
A producer row starts unsourced and renders as unverified, never as a finding. The sourcing engine runs every six hours and files candidate pages into a review queue; a person promotes a row only after reading the excerpt. The directory is a finding only when every row is one.
- [x] Producer-sourcing engine on a box timer, one Postgres queue, `/review` to decide
- [x] 48 of 92 producer rows sourced from the engine's candidates
- [x] Every capacity figure names its own unit
- [ ] Every remaining row sourced, or removed from the coverage universe

### Data quality that ratchets
Every dataset is held to six written criteria — completeness, correctness, provenance, freshness, link health, consistency. The pure checks run in `verify` and each check's failure count may only fall; the network checks run every six hours into a scorecard at `/data/quality`.
- [x] Six criteria declared per dataset, pure checks in the build, network checks on a rotation
- [x] Freshness page that fails the build on a stale committed dataset
- [ ] Every pure check at zero failures
- [ ] Link health and quote checks green across the whole corpus

## Next

### Calls at volume, proposed by the sweep
A handful of predictions is a hobby. The sweep should propose a call whenever an observation upstream implies a dated, checkable consequence in the market layer; a person accepts or rejects it; the resolution is scored in public, misses included. No hit rate is printed until enough calls have resolved for one to mean something.
- [x] The track record started: dated calls with a resolution rule and a floor before any rate is shown
- [x] The sweep proposes dated events for one-click review
- [ ] The sweep proposes calls, not only events
- [ ] The resolved-call record published with misses shown

### The three numbers that settle the comparison
Whether this is better than equity research is a claim that must be scorable: the share of binding bottlenecks with no listed pure-play at all, the median lead in days between a fact recorded here and its first appearance in the market layer, and the resolved-call record.
- [x] Uncovered materials computed from the coverage universe
- [ ] Uncovered-node share published as a figure with its source
- [ ] Lead measured from `recordedOn` against the market layer
- [ ] All three on one page, recomputed from the corpus

### Labs and people as entities
Science with names on it: the pipeline stages and the live paper and grant feeds exist; the laboratories and the people doing the work are still text on a page rather than entities with their own pages, relations and evidence.
- [x] Science pipeline with stages, live paper/grant feeds and who is doing it
- [ ] `lab` and `person` kinds in the entity registry
- [ ] A `Work` record linking papers and grants to bottlenecks

### Eight languages, honestly
The seams for eight languages exist and every non-English locale reports 0% coverage rather than serving machine-translated English. Translations arrive only with a reviewer's name on them.
- [x] String catalogue, locale metadata, fallback that reports itself
- [x] Profile modules and evidence vocabulary externalised
- [ ] Page-level copy externalised
- [ ] First reviewed translation of the interface
- [ ] Locale routing, once a locale is worth routing to
- [ ] The corpus itself, as a content operation with a review step

## Later

### Its own domain
`substrata.orangecat.ch` is an address, not an affiliation. The site moves to its own domain the day one is bought, and nothing in the repository changes when it does.

### The join page as a package
`lib/contribute.ts` is a portable model for an invitation to contribute that is not an offer of employment. It lifts into sitekit unchanged when a third project wants it; until then it stays a file.

## Shipped

### The atlas is a globe
One canvas, one bar, one panel: a 50m vector world painted by USGS production and reserves data, chains drawn as a flow, and a country panel with measured resources, producers, export restrictions, sanctions and ranked peers.

### Exposure, X-ray and scenarios over a sourced dependency layer
Paste a portfolio and see which bottlenecks it depends on; screen listed companies for exposure; run scenarios over dependency rows that are graph edges with a source each.

### Ask, on any model, with one-click claim verification
A context-aware assistant over the corpus that plans the obvious lookups before calling a model, cites what it reads, and runs on a reader's own key with any of ten vendors.

### Reader views and a shell for every page
Five reader views — for equity investors, policy, science, careers, learning — under one grouped sidebar, rail, phone tabs and a ⌘K palette, with every number linking to its source, rule or estimate.

### Self-updating research, reviewed by a person
Two engines on box timers fill one queue each; nothing publishes without a person reading the excerpt. Unreviewed leads expire after 30 days so a stale queue is a broken queue, not an unread one.
