# Where the data goes next

Written 2026-09-17, after a review of what the corpus actually says when you read it as a reader
rather than as its author. Three complaints drove it, and all three are fair.

## The three faults

**1. The geology directory is mostly noise.** 51 country rows, and **30 of them (59%) connect to no
bottleneck at all**. The most common resources are oil, natural gas, copper, uranium and gold — a
general commodities directory wearing this site's clothes. "Timor-Leste has some oil" is true and
tells a reader nothing about why technology is slow. Similar-geology matching built on it produces
noise, because the similarity is computed over resources that do not matter here.

**2. The corpus asserts concentration without substantiating it.** "One company on earth builds
them." "Produced only as a by-product of a few natural gas fields." Which company? Which fields?
Where? A reader is asked to take the most load-bearing claims on trust, which is the opposite of
what this project is for. It reads, in George's words, as a mystery wrapped in an enigma.

**3. There are no numbers.** Severity is a 0–12 judgement and everything else is prose. A reader
cannot ask how much is produced, how much is left, who has how much, or what would change it.

## What to build

### A. Quantify: production and reserves, per material and place

```ts
interface Quantity {
  value: number;
  unit: 'tonnes' | 'kt' | 'Mt' | 'Mcm' | 'GWh' | 'units';
  /** The year the figure is FOR, which is not the year it was published. */
  year: number;
  /** Estimated, reported, or a range — never a bare number pretending to be exact. */
  basis: 'reported' | 'estimated' | 'range';
  low?: number;
  high?: number;
  source: string;
  readOn: string;
}

interface Endowment {
  material: EntityId;          // bottleneck
  place: EntityId;             // country
  production?: Quantity;       // per year
  reserves?: Quantity;         // remaining
  share?: number;              // fraction of world production, DERIVED not stored
}
```

Rules:
- **Every figure carries its year, its basis and its source.** A number without a year is a lie with
  a decimal point.
- **Derived figures are computed, never stored**: world share, reserves-to-production ratio, and
  per-capita figures are functions of the rows, so they cannot drift from them.
- **Reserves are not resources.** USGS distinguishes them; so must we, or the number means nothing.

Primary source: **USGS Mineral Commodity Summaries** (2026 edition; US Government, public domain,
covers 90+ materials with production and reserves by country). Verified available earlier in this
work. National surveys and the IAEA Red Book for uranium fill gaps.

### B. Name the facilities

The claim "a few fields" becomes checkable only when the fields are named.

```ts
interface Facility {
  kind: 'field' | 'mine' | 'refinery' | 'plant' | 'fab';
  name: string;                // "LaBarge", "Ras Laffan", "Orenburg"
  place: EntityId;             // country
  operator?: EntityId;         // company
  makes: EntityId[];           // bottlenecks
  capacity?: Quantity;
  source: string;
  readOn: string;
}
```

This is a new **entity kind**, which is now a single adapter file. It answers "where are those
fields" directly, gives each one a profile and a discussion, and lets a helium page link the three
places its supply actually comes from.

### C. Per-capita and concentration, as derived reads

Interesting precisely because they are ratios the rows already support:
- reserves per capita, production per capita — which places are structurally rich rather than large;
- **Herfindahl-style concentration** per material — a numeric companion to the "how few suppliers
  qualify" judgement, computed from production shares rather than asserted;
- reserves-to-production ratio — how long the current rate can continue.

All derived. None stored. Each shown with the rows it came from.

### D. Strategic location is a constraint, and is not geology

Singapore holds no minerals and is central anyway. So are Hormuz, Bab el-Mandeb, Malacca, Suez,
Panama and Taiwan — and the Iran/Qatar helium event already in the corpus is exactly this: a war
near a strait threatening supply that is not produced there.

```ts
interface Chokepoint {
  name: string;                // "Strait of Hormuz"
  kind: 'strait' | 'canal' | 'cable' | 'corridor';
  places: EntityId[];          // countries controlling or adjacent
  carries: EntityId[];         // bottlenecks whose supply transits it
  why: string;
  source: string;
}
```

A `transits` relation joins a bottleneck to a chokepoint, so "what is in the way" includes the route
and not only the rock. This is the piece the current model misses entirely: it knows where things are
made and nothing about how they move.

### E. Prune the directory to the thesis

A country row earns its place when it connects to a bottleneck. The other 30 either gain a
connection with a source, or move behind an explicit "general geology, not part of the research"
boundary. Coverage is not a virtue when most of it is off-subject — it dilutes the rows that matter
and makes similarity matching meaningless.

## Presentation

- **Progressive disclosure, not omission.** A page opens with the claim and the number; the rows,
  years and sources sit one interaction deeper. Today the claim is shown and the substantiation does
  not exist at all, which is the wrong end of the trade.
- **Visual aids where they carry information**: production share by country, reserves-to-production,
  a supply route. Not decoration, and never a chart of a judgement — a 0–12 score plotted as a bar
  invites reading it as a measurement.
- Every number links to its source, like every other claim on the site.

## Roadmap, not now

- PDF and PPT export of a profile or a comparison.
- A comparison view across entities (the module contract already supports it).

## Order

1. USGS production and reserves for the materials already in the corpus — the numbers a reader asks
   for first, on rows that already matter.
2. Facilities for the most concentrated materials, so "a few fields" names them.
3. Derived reads: share, per-capita, concentration, R/P.
4. Chokepoints and the `transits` relation.
5. Prune or fence the off-thesis country rows.
