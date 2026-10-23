# chartkit

**One chart for every bitbaum product.** A line, ranked bars, a share bar, a
sparkline, a meter, a timeline and a strip of figures — drawn on the server
from the app's own tokens, each with a table behind it and no label that
clips, overlaps or shrinks — so a fix made once reaches every product.

Why it exists: on 2026-10-23 the owner said visualisations are "super
important", a profile must be "more useful than Bloomberg", and "it's packages
what makes us special". Substrata had one hand-rolled line chart and nothing
else; every other product had none. This is the one place charts now live.
(Colour and type come from [`design-tokens`](https://github.com/bitbaum/design-tokens);
chartkit is the drawing.)

## Install

```sh
pnpm add @bitbaum/chartkit@^0.1.0
```

Install releases from npm, never a commit or a branch, for the reason chatkit's
README gives: a semver range is what lets a fix reach every product.

## Use

```tsx
import { LineChart, BarChart, ShareBars, Sparkline, Meter, Timeline, StatTiles } from "@bitbaum/chartkit/react";
import "@bitbaum/chartkit/styles.css";

<LineChart
  series={[{ id: "backlog", label: "Backlog", points: [{ x: "2025-Q1", y: 29, href: "…" }] }]}
  unit="GW"
  caption="GE Vernova Gas Power equipment backlog, GW, by quarter."
  yFrom="zero"                       // or "data"; left out, zero only when the data sits near it
  height={208}                       // CSS px; the width is the container's
/>
<BarChart rows={[{ label: "China", value: 900000, share: 0.99, estimated: true }, { label: "Other", value: null }]} unit="kg" caption="…" highlight="China" />
<ShareBars rows={[{ label: "China", share: 0.99 }, { label: "Russia", share: 0.0067 }]} other={0.003} caption="…" />
<Sparkline points={points} label="Backlog over six quarters" />
<Meter value={12} max={12} label="Severity" href="/methods/severity" />
<Timeline events={[{ date: "2026-07-17", label: "…", tone: "down", href: "…" }]} caption="…" />
<StatTiles tiles={[{ label: "Bottlenecks mapped", value: 33, href: "/bottlenecks" }]} />
```

`x` is an ISO period (`2025`, `2025-Q2`, `2025-03`, `2025-03-31`) or a number.
Several series share one axis — there is no second y-axis and never will be;
two measures of different scale are two charts. `BarChart` ranks its rows
(largest first, no number last) whatever order they arrive in, draws a `null`
as "—" and an estimate with "≈". Every point of a `LineChart` and every event
of a `Timeline` is an anchor when it has an `href`, with its value, period and
note on hover and on keyboard focus.

## What every chart guarantees

- **It renders on the server.** Pure SVG and HTML, no effect, no measurement.
  The drawing is an SVG stretched to its box (`preserveAspectRatio="none"`,
  non-scaling strokes); every label is HTML in rem laid over it in per cent,
  so a 320px plot has the same type as a 1440px one.
- **Nothing is reachable only by pointing.** Each chart is a `<figure
  class="ck-chart">` with its caption and a visually hidden `<table>` of the
  same values; the decorative parts are `aria-hidden`, the anchors are not.
- **No label clips or overlaps.** Long labels truncate with an ellipsis and
  carry the full text in `title`; bar labels have a least column; timeline
  events that would collide take a second lane; the y gutter is as wide as
  its widest number. `@bitbaum/chartkit/audit` measures it (below).
- **Colour and type come only from `--ck-*` variables**, which default to
  design-tokens and can be set once on `:root`: `--ck-ink`, `--ck-ink-muted`,
  `--ck-line`, `--ck-bg`, `--ck-accent`, `--ck-up`, `--ck-down`,
  `--ck-series-1` … `-6`, `--ck-font`, `--ck-mono`. Series are by index, never
  cycled, and each after the first has a dash as well as a colour, so the set
  survives a monochrome theme and a print. The prefix is shared with chatkit
  on purpose: `--ck-line`, `--ck-accent`, `--ck-bg`, `--ck-font` and
  `--ck-mono` mean the same in both, so an app that themed its chat has themed
  its charts. Light and dark both work by token.

## The audit

```ts
import { CHART_DEFECTS_SOURCE } from "@bitbaum/chartkit/audit";
const defects = await page.evaluate(`(${CHART_DEFECTS_SOURCE})(document.body)`);
if (defects.length) throw new Error(defects.join("\n"));
```

`findChartDefects(root)` runs inside the page and returns every piece of chart
text whose box leaves its chart or overlaps another piece of text in the same
chart, one line each. Reading the CSS finds none of these; laying the words out
with the real font at the real width does. `test/browser.mjs` runs it over the
demo at 320, 390 and 1280px in light and dark, and first over a deliberately
broken figure, to prove the gate can fail.

## Develop

```sh
pnpm install
pnpm run verify       # format:check, lint, typecheck, build, test, test:browser
pnpm run demo         # builds demo/dist; open demo/index.html
```

`test:browser` needs Chromium: `pnpm exec playwright install chromium`, or set
`CHROMIUM_PATH`. `dist/` is committed so a `github:` install needs no build
step; `pnpm run check:dist` says whether it matches the source.
