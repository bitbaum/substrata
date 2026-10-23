// The arithmetic every chart shares. Each case is a way a chart has lied or
// collided somewhere: a flat line dividing by zero, a small value drawn as
// a large one, two events printed over each other, a label cut mid-word.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatShare,
  formatX,
  lanes,
  linePath,
  monthTicks,
  niceStep,
  numberTicks,
  timeTicks,
  truncate,
  valueScale,
  xExtent,
  xPercent,
  xPosition,
  yPercent,
} from "../dist/index.js";

test("periods are placed mid-period and read as a person writes them", () => {
  assert.equal(xPosition("2025"), Date.UTC(2025, 6, 1));
  assert.equal(xPosition("2025-Q2"), Date.UTC(2025, 4, 15));
  assert.equal(xPosition("2025-03"), Date.UTC(2025, 2, 15));
  assert.equal(xPosition("2025-03-31"), Date.UTC(2025, 2, 31));
  assert.equal(xPosition(7), 7);
  assert.ok(Number.isNaN(xPosition("soon")));
  assert.equal(formatX("2025"), "2025");
  assert.equal(formatX("2025-Q2"), "Q2 2025");
  assert.equal(formatX("2025-03"), "Mar 2025");
  assert.equal(formatX("2025-03-31"), "31 Mar 2025");
  assert.equal(formatX(1600000), "1,600,000");
});

test("the value axis is on round numbers, starts at zero only when the data is near it, and never divides by zero", () => {
  assert.equal(niceStep(100, 3), 50);
  assert.equal(niceStep(7, 3), 5);
  const near = valueScale([3, 48, 20]);
  assert.equal(near.min, 0);
  assert.equal(near.max, 60);
  assert.deepEqual(near.ticks, [0, 20, 40, 60]);
  const far = valueScale([128, 131, 126]);
  assert.equal(far.min, 126, "a lead time of 126–131 weeks is not drawn from zero");
  assert.equal(valueScale([128, 131, 126], "zero").min, 0);
  assert.equal(valueScale([3, 48], "data").min, 0, "the floor of 3 rounds to 0 on a step of 20");
  const flat = valueScale([3, 3, 3]);
  assert.ok(flat.max > flat.min);
  assert.equal(yPercent(60, near), 0);
  assert.equal(yPercent(0, near), 100);
});

test("x positions span the extent; a single point sits in the middle", () => {
  const extent = xExtent([{ points: [{ x: "2025-03-31" }, { x: "2026-06-30" }] }]);
  assert.equal(xPercent("2025-03-31", extent), 0);
  assert.equal(xPercent("2026-06-30", extent), 100);
  assert.equal(xPercent("2025", [5, 5]), 50);
  assert.equal(
    linePath([
      { x: 0, y: 100 },
      { x: 50.123, y: 2 },
    ]),
    "M0.00 100.00 L50.12 2.00",
  );
});

test("time ticks name years over a long span and months over a short one, never more than asked", () => {
  const years = timeTicks(Date.UTC(2015, 0, 1), Date.UTC(2026, 6, 1), 5);
  assert.ok(years.length <= 5 && years.length >= 2, `${years.length} year ticks`);
  assert.ok(years.every((t) => /^\d{4}$/.test(t.label)));
  const months = timeTicks(Date.UTC(2025, 2, 31), Date.UTC(2026, 5, 30), 5);
  assert.ok(months.length <= 5 && months.length >= 3, `${months.length} month ticks`);
  assert.match(months[0].label, /^[A-Z][a-z]{2} \d{4}$/, "the first month names its year");
  assert.ok(months.every((t) => t.pos >= 0 && t.pos <= 100));
  const numbers = numberTicks(0, 1000, 5);
  assert.deepEqual(
    numbers.map((t) => t.label),
    ["0", "200", "400", "600", "800", "1,000"],
  );
});

test("month ticks mark every month and label at most six, naming the year at January and first", () => {
  const ticks = monthTicks(Date.UTC(2025, 11, 1), Date.UTC(2026, 9, 1));
  assert.equal(ticks.length, 11, "December to October, the first month included");
  const labelled = ticks.filter((t) => t.label);
  assert.ok(labelled.length <= 6 && labelled.length >= 4, `${labelled.length} labelled`);
  assert.equal(labelled[0].label, "Dec 2025");
  assert.ok(labelled.some((t) => t.label === "Jan 2026" || t.label === "Feb"));
  assert.ok(ticks.every((t) => t.pos >= 0 && t.pos <= 100));
  assert.deepEqual(monthTicks(5, 5), []);
});

test("events whose spans would touch take separate lanes; the rest share the first", () => {
  const span = (p, w = 22) => [p, p + w];
  assert.deepEqual(lanes([span(0), span(50), span(100)]), [0, 0, 0]);
  assert.deepEqual(lanes([span(0), span(10), span(20), span(50)]), [0, 1, 2, 0]);
  // Out-of-order input is laned by position, not by index.
  assert.deepEqual(lanes([span(50), span(0), span(10)]), [0, 0, 1]);
  // A label facing left reaches back over the one before it.
  assert.deepEqual(
    lanes([
      [40, 70],
      [50, 80],
    ]),
    [0, 1],
  );
  assert.deepEqual(
    lanes(
      [
        [0, 10],
        [10, 20],
      ],
      1,
    ),
    [0, 1],
    "the gap keeps touching spans apart",
  );
});

test("a label is shortened at a word with an ellipsis and never cut mid-word when a word is near", () => {
  assert.equal(truncate("Short", 10), "Short");
  assert.equal(truncate("Taiwan Semiconductor Manufacturing Company", 22), "Taiwan Semiconductor…");
  assert.equal(truncate("Supercalifragilistic", 10), "Supercali…");
  assert.equal(
    truncate("a b cdefghijklmnop", 12),
    "a b cdefghi…",
    "no word in the last third: cut flat",
  );
});

test("shares read as a person says them", () => {
  assert.equal(formatShare(0.99), "99%");
  assert.equal(formatShare(0.0067), "<1%");
  assert.equal(formatShare(0.053), "5.3%");
  assert.equal(formatShare(0), "0%");
});
