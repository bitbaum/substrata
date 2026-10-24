# lib/coverage — is the picture good, and connecting the dots

Design: `docs/architecture/2026-10-24-research-systems.md` §4.

**The ratio.** For a country and a resource: the capacity of the USGS facility
rows whose operator is a `stated`/`corroborated` `operates` edge, over the
national production figure. Labelled every time as **named capacity / national
production**: capacity is not output, so it can pass 100%, and "named operators
made X% of output" is never claimed (no source here states production per
facility). Every result carries its rows, both sources and the arithmetic; one
that cannot be computed carries the reason.

| file | job |
| --- | --- |
| `capacity.ts` | a printed capacity cell → a number, `parts` per material, `not-printed` or `unreadable` (two figures, a range, a sentence). Never guessed, never divided |
| `units.ts` | exact factors within one family (kg/t/kt/Mt, m³, carats); anything else is `incomparable` |
| `basis.ts` | `SERIES_SPECS`: which row words measure what each national series measures (mine content, refinery, gross ore). A row that says another stage, a compound (Li2CO3, WO3, oxide) or nothing is reported, not added |
| `national.ts` | the national figure: USGS MCS, then WNA (uranium), then EIA — nearest year to the facility table, the gap stated |
| `rows.ts` | each printed row once (`rowKey`); a capacity printed once for a group (Kazakh uranium: 16 ventures, 24,000 t) is one figure, never per operator |
| `ratio.ts` | `coverageFor(iso2, resource)`, `coverageOf(iso2)` |
| `display.ts` | the headline (`≥100%` when named capacity covers the national figure; the exact ratio stays in the working), the "check the row" flag naming the printed row behind a ratio above `IMPLAUSIBLE_RATIO` (3) — data unaltered — and a "Locations:" cell split one place per line |
| `shares.ts` | rows with a named operator, operators with a stated owner, `ships_to` flows (no national export volume is held yet, so flows say so) |
| `rules.ts` | the three inference rules below |

**The rules** (pure, over the graph without proposals): `co-ownership` (A owns
V, V operates/owns facility F → A owns F, `derived`; share = product only for
one chain with both stakes stated), `same-parent` (operators with a common
non-country owner → `shares_parent_with`, `lead`), `registry-bridge` (a minted
company whose bare name equals a GLEIF/Wikidata-evidenced node →
`may_be_same_as`, `lead`; never merged — merges are `config/entity-aliases.ts`).

```bash
pnpm run research:derived-relations   # writes research/derived-relations.json
```

The store loads them into `proposals` (origin `rule`), apart from `all`: no
walk, dossier count, index or ratio reads them. `proposalsFor(id)` shows them.

Shown on `/world/<iso2>` ("How complete is this picture") and asked through
the chat tool `coverage_of`. Tests: `test/coverage.test.ts`,
`test/coverage-rules.test.ts`.
