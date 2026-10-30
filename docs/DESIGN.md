# How Substrata should look, move and help

Written 2026-10-12, from the owner's direction that day. `CONCEPT.md` says
what Substrata is for and who it serves; this says how it should feel to use,
and what every screen owes the person reading it. It is a working document:
the "Next" list is unbuilt.

---

## 1. The direction, in the owner's words, made precise

The owner asked for "something intelligence related … a futuristic, cyber,
intelligence vibe", then corrected it in the same breath: "not like spy
stuff … not even futuristic, just the best design we can make". Held
together, those mean one thing:

**An analyst's instrument, not a thriller's prop.** The register is the
desk of someone whose job is to know where things are and what depends on
what. It is precise, calm and dense, and it rewards a second look. It is
not neon, scanlines, fake terminals or glitch effects. Those signal
intelligence work without doing any, and the readers this site exists for
(below) see through them in a second.

What carries the "intelligence" feel is substance, rendered exactly:

- **Positions, not decoration.** A figure sits on the map where it is true:
  "Australia · 32%" at Australia, not in a table beside the globe.
- **Monospace for what was measured.** Shares, tickers, coordinates, dates
  and codes are set in the mono face. Prose stays in the sans. The reader
  learns that mono means "a recorded value".
- **Every claim has a source one tap away,** and the screen says when
  something is a judgement rather than a finding. Trust is the aesthetic.
- **Black, white and one ramp.** Colour means quantity, the amber ramp, and
  nothing else. Status colours mean status. Restraint makes the one
  highlighted country unmissable.

## 2. Motion: only when it tells you something

Animation is welcome where it answers a question the reader just asked, and
nowhere else. Every motion is still for `prefers-reduced-motion`.

| Motion | What it answers | Where |
|---|---|---|
| The globe flies to a country, along the great circle, pulling back on a long turn | "Where is that?" | `@bitbaum/geo-kit/map` (`flight`) |
| A ring opens from the picked country as the globe arrives | "That one — here" | `globe-marks.ts` |
| Picking a resource turns the globe to its largest producer | "Where does it come from?" | `Globe.tsx` |
| A site flies in close; a route is framed whole | "Show me that place" / "Show me the chain" | `Globe.tsx` |
| A light runs along each route arc, input to output | "Which way does it move?" | `globe-overlay.ts` |
| A dash runs along the chain's lines, input to output | "Which way does it flow?" | `ChainLinks.tsx` |
| Cards rise in, staggered, when a chain opens | "This is new" | `atlas-chain.css` |

Motion that answers nothing (idle shimmer, parallax, number tickers that
roll for show) is not added.

## 3. Who comes back, and why

People return to a tool that changes what they do on Monday. Each reader
the site already names (`config/audiences.ts`) needs one thing from every
chain and every map, and gets it as a row under "What you can do"
(`app/atlas/chain-actions.ts`):

| Reader | What brings them back | What the chain gives them |
|---|---|---|
| Equity investors | Knowing which listed names sit on a chokepoint before the market prices it | The listed holders and tickers on file, and the stop scenario |
| Commodity traders | Where supply is concentrated, and which rule could move it | The raw material on the globe, and the rules that touch the bottleneck |
| Industry teams | How long a constraint lasts and what could relieve it | The relief pipeline with its best readiness, and whether money is the constraint |
| Job seekers | Where the work that matters is hiring | Open roles filed under the bottleneck |
| Learners | Understanding the machine that makes machines | The dossier, in order, with every source |

Since #176 these are not a separate block but six readings of the chain,
tabs in its panel (`app/atlas/lenses/`, `components/portal/ChainLenses.tsx`):
Overview, Markets, Research, Money, People, Policy. Every lens has one shape —
what it means, the figures, the records, where all of it lives — and names
the reader it serves most.

Rules for those readings: every link points at a page that already exists,
filtered to this bottleneck. Its line is built from the data and never
written by hand. A row with nothing behind it is not shown. "Not investment
advice" sits beside it, every time.

## 4. Rules every screen keeps

1. **It says what it means in plain words.** A chain has a one-sentence
   lede and a short story (`app/atlas/chain-story.ts`), built from the same
   rows the diagram draws.
2. **Nothing leaves the map by accident.** A maker opens in the panel; the
   full profile is one deliberate link further.
3. **It works at 390px first.** The diagram stacks, the sheet rises, and
   nothing scrolls sideways.
4. **Tokens only.** Every colour and size comes from `app/globals.css`; a
   canvas reads the same tokens (`readPalette`).

## 5. Done, and next

Done on 2026-10-12:

- **Producers on the globe.** `research/producer-places.json` places each
  USGS facility location from GeoNames, offline, with its precision stated
  (site, town, region) and the entry it came from. `test/producer-sites.test.ts`
  fails if a dot lands in another country or a named province does not hold
  it; the quality page measures the same. Drawn by `globe-overlay.ts`.
- **Chains on the globe.** `app/atlas/chain-route.ts` is the one route model:
  the diagram (`AtlasChain.tsx`) and the globe (`?view=world&chain=`) both
  read it, numbered the same.

Next, in order:

1. **A reader setting.** Let a reader say who they are once (`/for/<id>`
   already exists) and lead every "What you can do" with their row.
2. **AI-written briefs, sourced.** For each chain, a short brief drafted by
   the model from the corpus rows only, every sentence linked to the row it
   came from, marked as drafted until an analyst signs it.
3. **More on the map.** The overlay takes any point layer with a precision:
   the corpus's own makers (fabs, refineries) and the export rules by country
   are the next two, both already on file.
4. **Dark by default on the atlas.** The map reads best on black; offer it
   as the atlas default while the rest of the site follows the reader's
   theme.
