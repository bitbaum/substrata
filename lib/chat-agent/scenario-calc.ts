/**
 * Scenarios: the model writes the framing, code writes the numbers.
 *
 * A low/base/high case is reasoning, and reasoning is where a model's
 * arithmetic goes wrong in the most persuasive way: "≈5% a year, so about 300
 * by 2030" reads as analysis whether or not 1.05^5 × 230 is 300. So in
 * research mode (research.ts) the model never writes a scenario number. It
 * writes a `scenario` block naming its INPUTS — each a figure a cited passage
 * prints, with its [W#] — and its CASES as references to those inputs; this
 * file checks every input against the passage it cites, computes every case
 * with the formula shown, and draws the block the reader sees, labelled as
 * reasoning worked out from cited inputs, never as a sourced forecast.
 *
 * Rates a case may use: `flat` (0 %/yr), an input id whose unit is `%`
 * (a cited growth rate), or `cagr:<a>:<b>` (the yearly rate between two dated
 * cited levels, computed here). A case may also carry `shock`: an input id
 * whose unit is `%`, taken off the starting level once (a supply cut).
 */
import { numbersIn } from './grounding';

export interface ScenarioInput {
  id: string;
  label: string;
  value: number;
  /** `%` for a rate or a share; otherwise the level's unit. */
  unit?: string;
  year?: number;
  /** The passage it comes from: `W3`. */
  cite: string;
}

export interface ScenarioSpec {
  measure: string;
  unit: string;
  inputs: ScenarioInput[];
  /** The input the cases start from. */
  start: string;
  horizon: number;
  cases: { name: string; rate?: string; shock?: string }[];
  assumptions?: string[];
}

export interface ScenarioCase {
  name: string;
  /** Yearly growth used, as a fraction. */
  rate: number;
  /** Where the rate came from, in words, with its citation. */
  rateFrom: string;
  shock?: number;
  value: number;
  /** The arithmetic, written out. */
  formula: string;
}

export interface Scenario {
  spec: ScenarioSpec;
  startValue: number;
  startYear: number;
  years: number;
  cases: ScenarioCase[];
  /** Inputs a cited passage prints: the only ones used. */
  inputs: ScenarioInput[];
  /** Inputs the passages did not print: dropped, with every case that used them. */
  rejected: string[];
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** The ```scenario block the model wrote, parsed; null when there is none or it is not JSON. */
export function scenarioSpecIn(answer: string): { spec: ScenarioSpec; block: string } | null {
  const m = answer.match(/```scenario\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    const raw = JSON.parse(m[1]) as Partial<ScenarioSpec>;
    if (!Array.isArray(raw.inputs) || !Array.isArray(raw.cases)) return null;
    const spec: ScenarioSpec = {
      measure: String(raw.measure ?? '').slice(0, 120),
      unit: String(raw.unit ?? '').slice(0, 40),
      start: String(raw.start ?? ''),
      horizon: Number(raw.horizon),
      inputs: raw.inputs
        .filter((i) => i && typeof i === 'object' && num(i.value) !== undefined)
        .map((i) => ({
          id: String(i.id),
          label: String(i.label ?? i.id).slice(0, 140),
          value: i.value,
          unit: i.unit ? String(i.unit).slice(0, 40) : undefined,
          year: num(i.year),
          cite: String(i.cite ?? '').replace(/[[\]]/g, ''),
        })),
      cases: raw.cases.slice(0, 4).map((c) => ({
        name: String(c?.name ?? '').slice(0, 30),
        rate: c?.rate ? String(c.rate) : undefined,
        shock: c?.shock ? String(c.shock) : undefined,
      })),
      assumptions: (raw.assumptions ?? []).map((a) => String(a).slice(0, 240)).slice(0, 5),
    };
    return { spec, block: m[0] };
  } catch {
    return null;
  }
}

/** Whether a cited passage prints this value (as written, or its magnitude for a fall). */
export function inputBacked(input: ScenarioInput, passages: Map<number, string>): boolean {
  const n = Number(input.cite.replace(/^W/i, ''));
  const text = passages.get(n);
  if (!text) return false;
  const known = numbersIn(text);
  const abs = Math.abs(input.value);
  return known.has(String(abs)) || known.has(String(input.value));
}

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

/** A number rounded for reading: three significant figures, thousands separated. */
export function fmt(n: number): string {
  const digits = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2;
  return n.toLocaleString('en', { maximumFractionDigits: digits });
}

/**
 * The scenario, computed. Inputs the passages do not print are rejected, and
 * so is every case that rests on one. Null when no start level survives or
 * fewer than two cases can be computed: then there is no scenario to show.
 */
export function scenario(spec: ScenarioSpec, passages: Map<number, string>): Scenario | null {
  const rejected: string[] = [];
  const inputs = new Map<string, ScenarioInput>();
  for (const i of spec.inputs) {
    if (inputBacked(i, passages)) inputs.set(i.id, i);
    else rejected.push(`${i.label} (${i.value}${i.unit === '%' ? '%' : ''}, [${i.cite}])`);
  }
  const start = inputs.get(spec.start);
  if (!start || start.unit === '%' || !Number.isFinite(spec.horizon)) return null;
  const startYear = start.year ?? spec.horizon;
  const years = spec.horizon - startYear;
  if (years <= 0 || years > 30) return null;
  const pctInput = (id: string) => {
    const i = inputs.get(id);
    return i && i.unit === '%' ? i : undefined;
  };
  const cases: ScenarioCase[] = [];
  for (const c of spec.cases) {
    let rate = 0;
    let rateFrom = 'held flat (0% a year)';
    let rateTerm = '';
    const r = c.rate ?? 'flat';
    const cagr = r.match(/^cagr:([^:]+):([^:]+)$/);
    if (cagr) {
      const a = inputs.get(cagr[1]);
      const b = inputs.get(cagr[2]);
      if (!a || !b || !a.year || !b.year || b.year <= a.year || a.value <= 0) continue;
      rate = (b.value / a.value) ** (1 / (b.year - a.year)) - 1;
      rateFrom = `the ${a.year}–${b.year} trend, (${fmt(b.value)} ÷ ${fmt(a.value)})^(1/${b.year - a.year}) − 1 = ${pct(rate)} [${b.cite}]`;
    } else if (r !== 'flat') {
      const i = pctInput(r);
      if (!i) continue;
      rate = i.value / 100;
      rateFrom = `${i.label}, ${pct(rate)} a year [${i.cite}]`;
    }
    rateTerm = ` × (1 + ${pct(rate)})^${years}`;
    let shock: number | undefined;
    let shockTerm = '';
    if (c.shock) {
      const s = pctInput(c.shock);
      if (!s) continue;
      shock = Math.abs(s.value) / 100;
      shockTerm = ` × (1 − ${pct(shock)})`;
    }
    const value = start.value * (1 - (shock ?? 0)) * (1 + rate) ** years;
    cases.push({
      name: c.name || `Case ${cases.length + 1}`,
      rate,
      rateFrom,
      shock,
      value,
      formula: `${fmt(start.value)}${shockTerm}${rateTerm} = ${fmt(value)}`,
    });
  }
  if (cases.length < 2) return null;
  return {
    spec,
    startValue: start.value,
    startYear,
    years,
    cases,
    inputs: [...inputs.values()],
    rejected,
  };
}

/** The block the reader sees: a table with the arithmetic, the inputs cited, a line chart. */
export function renderScenario(s: Scenario): string {
  const { spec } = s;
  const unit = spec.unit ? ` ${spec.unit}` : '';
  const cited = s.inputs;
  const levels = cited
    .filter((i) => i.unit !== '%' && i.year && (!i.unit || i.unit === spec.unit))
    .sort((a, b) => a.year! - b.year!);
  const chart = {
    type: 'chart',
    chart: 'line',
    caption: `${spec.measure}: scenarios worked out from cited inputs — reasoning, not a sourced forecast`,
    unit: spec.unit || undefined,
    series: [
      ...(levels.length >= 2
        ? [
            {
              id: 'cited',
              label: 'Cited',
              points: levels.map((i) => ({ x: String(i.year), y: i.value })),
            },
          ]
        : []),
      ...s.cases.map((c, i) => ({
        id: `case-${i}`,
        label: c.name,
        points: [
          { x: String(s.startYear), y: s.startValue },
          { x: String(spec.horizon), y: Number(c.value.toFixed(2)) },
        ],
      })),
    ],
  };
  return [
    `**Worked out in code from the cited inputs below — reasoning, not a sourced forecast.**`,
    '',
    `| Case | Growth assumed | ${spec.measure}, ${spec.horizon} | Arithmetic |`,
    '|---|---|---|---|',
    ...s.cases.map(
      (c) =>
        `| ${c.name} | ${c.rateFrom}${c.shock ? `; ${pct(c.shock)} cut first` : ''} | ${fmt(c.value)}${unit} | ${c.formula} |`,
    ),
    '',
    `Inputs: ${cited.map((i) => `${i.label}: ${fmt(i.value)}${i.unit === '%' ? '%' : i.unit ? ` ${i.unit}` : unit} [${i.cite}]`).join('; ')}.`,
    ...(spec.assumptions?.length ? ['', `Assumptions: ${spec.assumptions.join('; ')}.`] : []),
    ...(s.rejected.length
      ? ['', `Left out, because the cited page does not print it: ${s.rejected.join('; ')}.`]
      : []),
    '',
    '```chat_ui',
    JSON.stringify(chart),
    '```',
  ].join('\n');
}
