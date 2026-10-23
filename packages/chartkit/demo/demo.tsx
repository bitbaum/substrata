// The visual check: every chart on one page, in light and dark, drawn from
// Substrata's own data (research/series.json, research/usgs-mcs.json and
// config/substrata-events.ts, copied here with their sources so the package
// stays standalone). `pnpm run demo` builds demo/dist/; open demo/index.html.
// test/browser.mjs opens it at 320, 390 and 1280 and runs the audit.
import { createRoot } from "react-dom/client";
import {
  BarChart,
  LineChart,
  Meter,
  ShareBars,
  Sparkline,
  StatTiles,
  Timeline,
} from "../src/react/index.js";

// GE Vernova quarterly earnings releases (SEC 8-K Ex.99), read by Substrata:
// period, backlog GW, slot reservations GW, filing, quarter.
const GEV = [
  ["2025-03-31", 29, 21, "000199681025000072", "1q25"],
  ["2025-06-30", 29, 25, "000199681025000132", "2q25"],
  ["2025-09-30", 33, 29, "000199681025000159", "3q25"],
  ["2025-12-31", 40, 43, "000199681026000012", "4q25"],
  ["2026-03-31", 44, 56, "000199681026000063", "1q26"],
  ["2026-06-30", 53, 63, "000199681026000147", "2q26"],
] as const;
const href = (n: string, q: string) =>
  `https://www.sec.gov/Archives/edgar/data/1996810/${n}/gevpressrelease${q}.htm`;

const backlog = GEV.map(([x, y, , n, q]) => ({ x, y, href: href(n, q) }));
const slots = GEV.map(([x, , y, n, q]) => ({ x, y, href: href(n, q) }));

// USGS Mineral Commodity Summaries 2026, gallium: world low-purity
// production, kilograms of gallium content. 2025 estimated.
const GALLIUM = [
  {
    label: "China",
    value: 900000,
    share: 0.99,
    href: "https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gallium.pdf",
    estimated: true,
  },
  { label: "Russia", value: 6000, share: 0.0067, estimated: true },
  { label: "Japan", value: 3000, share: 0.0033, estimated: true },
  {
    label: "United States",
    value: 0,
    share: 0,
    note: "No primary production; recovery from scrap only.",
  },
  { label: "Other countries", value: null, share: 0 },
];

// Events on Substrata's bottlenecks (config/substrata-events.ts).
const EVENTS = [
  {
    date: "2025-12-03",
    label: "Coherent adds 300 mm capability to its silicon carbide platform.",
    tone: "up",
    kind: "capacity",
  },
  {
    date: "2026-03-27",
    label: "The European Commission opens a safeguard investigation into GOES imports.",
    tone: "down",
    kind: "policy",
  },
  {
    date: "2026-04-15",
    label: "Samsung weighs moving legacy memory packaging to Vietnam.",
    tone: "up",
    kind: "capacity",
  },
  {
    date: "2026-06-30",
    label: "The Quartz Corp restructures its US operations.",
    tone: "neutral",
    kind: "filing",
  },
  {
    date: "2026-07-17",
    label: "SK Siltron is liquidating SK Siltron CSS, its US silicon carbide wafer subsidiary.",
    tone: "down",
    kind: "capacity",
  },
  {
    date: "2026-07-28",
    label: "Shanghai Electric wins its first overseas heavy-duty gas turbine order.",
    tone: "up",
    kind: "milestone",
  },
  {
    date: "2026-08-27",
    label: "Tokuyama opens a polysilicon factory in Vietnam.",
    tone: "up",
    kind: "capacity",
  },
  {
    date: "2026-09-05",
    label: "Wacker's 600-worker Charleston polysilicon plant may close.",
    tone: "down",
    kind: "capacity",
  },
  {
    date: "2026-09-10",
    label: "The EU adds ALD equipment for molybdenum and ruthenium to its dual-use list.",
    tone: "down",
    kind: "policy",
  },
  {
    date: "2026-09-14",
    label: "Samsung's HBM4 passes Nvidia qualification.",
    tone: "up",
    kind: "milestone",
  },
] as const;

function Demo() {
  return (
    <>
      <section>
        <h2>StatTiles — the corpus in four numbers</h2>
        <StatTiles
          caption="The corpus in numbers"
          tiles={[
            { label: "Bottlenecks mapped", value: 33, href: "#" },
            { label: "Maker rows sourced", value: "61/90", href: "#" },
            { label: "Rules tracked", value: 24, href: "#" },
            { label: "Possible fixes", value: 18, href: "#" },
          ]}
        />
      </section>
      <section>
        <h2>LineChart — one series, every point a link</h2>
        <LineChart
          series={[{ id: "backlog", label: "Gas Power equipment backlog", points: backlog }]}
          unit="GW"
          caption="GE Vernova Gas Power equipment backlog (firm orders), GW, Q1 2025 to Q2 2026. Source: GE Vernova earnings releases."
        />
      </section>
      <section>
        <h2>LineChart — two series on shared axes, from zero</h2>
        <LineChart
          series={[
            { id: "backlog", label: "Backlog (firm orders)", points: backlog },
            { id: "slots", label: "Slot reservation agreements", points: slots },
          ]}
          unit="GW"
          yFrom="zero"
          caption="GE Vernova gas turbine backlog beside slot reservations not yet in it, GW, quarterly."
        />
      </section>
      <section>
        <h2>BarChart — ranked, with a null and an estimate</h2>
        <BarChart
          rows={GALLIUM}
          unit="kg"
          highlight="China"
          caption="Low-purity primary gallium production by country, 2025 (estimated), kilograms of gallium content. USGS Mineral Commodity Summaries 2026."
        />
      </section>
      <section>
        <h2>ShareBars — one bar, a legend</h2>
        <ShareBars
          rows={[
            { label: "China", share: 0.99, href: "#" },
            { label: "Russia", share: 0.0067 },
            { label: "Japan", share: 0.0033 },
          ]}
          caption="Share of world low-purity gallium production, 2025 (estimated). USGS."
        />
        <ShareBars
          rows={[
            { label: "Taiwan Semiconductor Manufacturing Company", share: 0.62 },
            { label: "Samsung", share: 0.13 },
            { label: "SMIC", share: 0.06 },
            { label: "UMC", share: 0.05 },
          ]}
          other={0.14}
          caption="Foundry revenue share, Q1 2026 (illustrative shapes for the layout check, not a finding)."
        />
      </section>
      <section>
        <h2>Timeline — events in lanes</h2>
        <Timeline
          events={[...EVENTS]}
          caption="Events on Substrata's bottlenecks, December 2025 to September 2026. Green moved a bottleneck looser, red tighter."
        />
      </section>
      <section>
        <h2>Sparkline and Meter — inline</h2>
        <p className="inline">
          <span>
            Backlog <Sparkline points={backlog} label="Backlog over six quarters" /> +83%
          </span>
          <span>
            Severity <Meter value={12} max={12} label="Severity" href="#" />
          </span>
          <span>
            Severity <Meter value={7} max={12} label="Severity" />
          </span>
        </p>
      </section>
    </>
  );
}

createRoot(document.getElementById("demo")!).render(<Demo />);
