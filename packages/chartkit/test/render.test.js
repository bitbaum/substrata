// Every chart renders on the server (Next RSC/SSR) and carries the parts the
// standard requires: a figure, a caption, a table of the same values, a
// link where a point has a source, and nothing that needs a browser to
// exist. Rendered to a string: a chart that cannot even render without a
// browser breaks every page it is put on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BarChart,
  LineChart,
  Meter,
  ShareBars,
  Sparkline,
  StatTiles,
  Timeline,
} from "../dist/react/index.js";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const points = [
  { x: "2025-03-31", y: 29, href: "https://example.com/q1" },
  { x: "2025-06-30", y: 29, href: "https://example.com/q2", preliminary: true },
  { x: "2025-09-30", y: 33, note: "Converted 7 GW of slots." },
];

test("LineChart: a figure, a stretched SVG, a point per value as a link, a table behind it", () => {
  const html = renderToStaticMarkup(
    h(LineChart, {
      series: [{ id: "a", label: "Backlog", points }],
      unit: "GW",
      caption: "Backlog, GW",
    }),
  );
  assert.match(html, /<figure class="ck-chart ck-chart-line"/);
  assert.match(html, /viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"/);
  assert.match(html, /vector-effect="non-scaling-stroke"/);
  assert.equal((html.match(/class="ck-pt/g) ?? []).length, 3);
  assert.match(html, /<a href="https:\/\/example.com\/q1" class="ck-pt"[^>]*target="_blank"/);
  assert.match(html, /aria-label="29 GW, 30 Jun 2025 · preliminary"/);
  assert.match(html, /<span class="ck-tip" role="tooltip">/);
  assert.match(html, /Converted 7 GW of slots\./);
  assert.match(html, /<figcaption class="ck-chart-caption">Backlog, GW<\/figcaption>/);
  assert.match(
    html,
    /<div class="ck-sr"><table class="ck-chart-table"><caption>Backlog, GW<\/caption>/,
  );
  assert.match(html, /<th scope="col">Backlog \(GW\)<\/th>/);
  assert.match(html, /<th scope="row">31 Mar 2025<\/th><td>29<\/td>/);
  assert.match(html, /<td>29 \(preliminary\)<\/td>/);
  assert.match(html, /--ck-gutter:3ch/, "the gutter is as wide as the widest tick label");
  assert.doesNotMatch(html, /useEffect|undefined|NaN/);
});

test("LineChart: two series share axes, get a legend and a dash each", () => {
  const html = renderToStaticMarkup(
    h(LineChart, {
      series: [
        { id: "a", label: "Backlog", points },
        { id: "b", label: "Slots", points: points.map((p) => ({ ...p, y: p.y * 2 })) },
      ],
      caption: "Two",
      yFrom: "zero",
    }),
  );
  assert.equal((html.match(/class="ck-line-path"/g) ?? []).length, 2);
  assert.match(html, /<ol class="ck-legend"/);
  assert.match(html, /data-series="2"/);
  assert.match(
    css,
    /\.ck-line-path\[data-series="2"\][^{]*\{\s*stroke-dasharray/,
    "the second series is dashed, so it survives a monochrome theme",
  );
  assert.match(html, /<span class="ck-line-tick">0<\/span>/);
});

test("BarChart: ranked largest first, a null drawn as a dash, an estimate marked, a long label shortened with its full text in title", () => {
  const html = renderToStaticMarkup(
    h(BarChart, {
      rows: [
        { label: "Japan", value: 3000, share: 0.0033 },
        { label: "China", value: 900000, share: 0.99, estimated: true, href: "/china" },
        { label: "Other countries with a very long name indeed", value: null },
      ],
      unit: "kg",
      caption: "Gallium",
      highlight: "China",
    }),
  );
  const order = [...html.matchAll(/class="ck-bar-label" title="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ["China", "Japan", "Other countries with a very long name indeed"]);
  assert.match(html, /ck-bar-row ck-bar-row-hi/);
  assert.match(html, /<a href="\/china" class="ck-bar-label" title="China">China<\/a>/);
  assert.match(html, /<span class="ck-bar-none">—<\/span>/);
  assert.match(html, /<span class="ck-bar-est" title="Estimated">≈<\/span>900,000/);
  assert.match(html, /<span class="ck-bar-share">99%<\/span>/);
  assert.match(html, />Other countries with a…<\/span>/);
  assert.match(html, /style="width:100%"/);
  assert.match(html, /<td>—<\/td>/);
  assert.match(html, /<td>900,000 \(estimated\)<\/td>/);
});

test("ShareBars: one bar whose widths sum to 100%, the largest labelled inside, every segment in the legend", () => {
  const html = renderToStaticMarkup(
    h(ShareBars, {
      rows: [
        { label: "Samsung", share: 0.13 },
        { label: "Taiwan Semiconductor Manufacturing Company", share: 0.62, href: "/tsmc" },
      ],
      other: 0.25,
      caption: "Share",
    }),
  );
  const widths = [...html.matchAll(/class="ck-share-seg[^"]*"[^>]*style="width:([\d.]+)%"/g)].map(
    (m) => Number(m[1]),
  );
  assert.deepEqual(widths, [62, 13, 25]);
  assert.equal((html.match(/ck-share-inside/g) ?? []).length, 1);
  assert.match(html, /<span class="ck-share-inside">Taiwan Semico… 62%<\/span>/);
  assert.match(html, /ck-share-seg ck-share-other/);
  assert.match(
    html,
    /<a href="\/tsmc" class="ck-legend-label" title="Taiwan Semiconductor Manufacturing Company">/,
  );
  assert.match(html, /<th scope="row">Other<\/th><td>25%<\/td>/);
  assert.match(
    css,
    /@container \(min-width: 9rem\)/,
    "the inside label shows only where the segment has room",
  );
});

test("Sparkline: inline, no axes, named; nothing with one point", () => {
  const html = renderToStaticMarkup(h(Sparkline, { points, label: "Backlog over three quarters" }));
  assert.match(
    html,
    /<svg class="ck-spark"[^>]*role="img" aria-label="Backlog over three quarters"/,
  );
  assert.match(html, /style="width:88px;height:28px"/);
  assert.doesNotMatch(html, /<text/);
  assert.equal(renderToStaticMarkup(h(Sparkline, { points: [points[0]], label: "x" })), "");
});

test("Meter: the number beside a track, a real meter role, a link when it has one", () => {
  const html = renderToStaticMarkup(
    h(Meter, { value: 12, max: 12, label: "Severity", href: "/method" }),
  );
  assert.match(
    html,
    /<a href="\/method" class="ck-chart ck-meter" title="Severity: 12 of 12" style="--ck-meter:100%">/,
  );
  assert.match(html, /<span class="ck-meter-value">12<\/span>/);
  assert.match(
    html,
    /role="meter" aria-valuemin="0" aria-valuemax="12" aria-valuenow="12" aria-label="Severity"/,
  );
  assert.match(
    renderToStaticMarkup(h(Meter, { value: 7, max: 12, label: "S" })),
    /--ck-meter:58\.33/,
  );
});

test("StatTiles: an even grid, one shape per cell, a link where there is one, a table", () => {
  const html = renderToStaticMarkup(
    h(StatTiles, {
      tiles: [
        { label: "Bottlenecks mapped", value: 33, href: "/bottlenecks" },
        { label: "Rules tracked", value: 24, note: "since 2024" },
      ],
    }),
  );
  assert.match(html, /class="ck-chart ck-chart-tiles" style="--ck-n:2"/);
  assert.match(
    html,
    /<a href="\/bottlenecks" class="ck-tile"><span class="ck-tile-value">33<\/span><span class="ck-tile-label">Bottlenecks mapped<\/span><\/a>/,
  );
  assert.match(html, /<span class="ck-tile-note">since 2024<\/span>/);
  assert.match(html, /<th scope="row">Rules tracked<\/th><td>24<\/td><td>since 2024<\/td>/);
  assert.match(
    css,
    /\.ck-tiles \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
    "two across on a phone",
  );
});

test("Timeline: events as anchors on month ticks, colliding ones in a second lane, each no wider than its room", () => {
  const html = renderToStaticMarkup(
    h(Timeline, {
      events: [
        {
          date: "2026-07-17",
          label: "SK Siltron liquidates its US subsidiary",
          tone: "down",
          href: "/e1",
        },
        { date: "2026-07-28", label: "Shanghai Electric wins an overseas order", tone: "up" },
        {
          date: "2026-03-27",
          label: "EU opens a safeguard investigation",
          tone: "down",
          kind: "policy",
        },
      ],
      caption: "Events",
    }),
  );
  assert.equal((html.match(/class="ck-tl-lane"/g) ?? []).length, 2, "July's two events collide");
  assert.match(html, /style="--ck-lanes:2"/);
  assert.match(
    html,
    /<a href="\/e1" class="ck-tl-event ck-tl-left" title="17 Jul 2026: SK Siltron liquidates its US subsidiary"/,
  );
  assert.match(html, /data-tone="down" data-kind="policy"/);
  assert.match(html, /--ck-room:\d/);
  assert.ok((html.match(/class="ck-tl-tick/g) ?? []).length >= 5, "a mark per month");
  assert.match(html, /<span class="ck-tl-month">Mar 2026<\/span>/);
  assert.match(
    html,
    /<th scope="row">27 Mar 2026<\/th><td>EU opens a safeguard investigation<\/td><td>down<\/td>/,
  );
});

test("no literal colour in a component: every colour is a --ck-* variable", () => {
  for (const file of ["LineChart", "Bars", "Small", "Timeline", "Figure"]) {
    const src = readFileSync(new URL(`../src/react/${file}.tsx`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i, `${file}.tsx names a colour`);
  }
  for (const name of ["ink", "ink-muted", "line", "series-1", "series-6", "up", "down", "accent"]) {
    assert.match(css, new RegExp(`--ck-${name}:`), `--ck-${name} is defined`);
  }
  assert.doesNotMatch(css, /font-size:\s*0\.[0-6]\d*rem/, "no label under 0.75rem");
});
