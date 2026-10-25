/**
 * Research mode, the answer's shape (docs/architecture/2026-10-25-research-mode.md).
 *
 * An analyst's answer to "what will demand for neon be?" is not one table: it
 * is a bottom line, then what is established, what drives it, how it could go,
 * what to watch, and how sure anyone can be. The model is asked for that shape
 * (`researchInstruction`); code makes sure of the parts code can make sure of:
 * - the bottom line comes first, before any heading;
 * - the sections run in one order, and "Sources" is built from the [W#] the
 *   answer actually cites;
 * - an uncited forecast stated as fact ("demand will double by 2030") goes;
 * - every sub-question no page answered is said once, in "Confidence and
 *   gaps", by code — a gap is never left for the model to forget.
 */
import { REASONING } from './labels';
import type { ResearchPlan, SubQuestion } from './research-plan';
import type { ResearchPassage } from './research-read';

/** The sections, in order. The bottom line is the prose before the first heading. */
export const SECTIONS = [
  'What is established',
  'What drives it',
  'Scenarios',
  'What would change this',
  'Confidence and gaps',
  'Sources',
] as const;

/** Sections whose lines are the answer's own reasoning, held to the background rules. */
export const REASONING_SECTIONS = /^(scenarios|what would change this|confidence and gaps)\b/i;

const PLACEHOLDER = '[[scenario-table]]';

/** What the writer is told in research mode, after the ordinary system prompt. */
export function researchInstruction(plan: ResearchPlan, passages: ResearchPassage[]): string {
  const bySub = plan.subQuestions.map((s) => {
    const cites = passages.filter((p) => p.for === s.id).map((p) => `[W${p.n}]`);
    return `- ${s.ask}: ${cites.length ? cites.join(' ') : 'no page found — say so under Confidence and gaps'}`;
  });
  return [
    '## Research mode: answer as an analyst',
    `This is an analytical, forward-looking question about ${plan.subject}. The web was searched for these sub-questions; the passages above are numbered [W#]:`,
    ...bySub,
    'Write the answer in exactly this shape, with these markdown headings (### level), leaving out a section only when nothing above bears on it:',
    '1. No heading: a direct bottom line in 2–3 sentences — your view, with the one or two figures it rests on, each cited.',
    '### What is established — cited facts with numbers and dates, global before national, each [W#] or corpus link right after the claim.',
    '### What drives it — the drivers (end uses, technology mix, capacity, policy, shocks and recoveries), each quantified where a passage quantifies it, cited.',
    `### Scenarios — low / base / high as clearly labelled reasoning. Do NOT write any scenario number yourself. Write one or two framing sentences opening with "${REASONING}", then a fenced block \`\`\`scenario holding ONE JSON object: {"measure":"…","unit":"…","inputs":[{"id":"a","label":"…","value":180,"year":2021,"cite":"W2"},{"id":"g","label":"…","value":6.5,"unit":"%","cite":"W4"}],"start":"a","horizon":2030,"cases":[{"name":"Low","rate":"flat"},{"name":"Base","rate":"cagr:a:b"},{"name":"High","rate":"g"}],"assumptions":["…"]}. Every input value must be printed in the passage it cites; a rate is "flat", an input id with unit "%", or "cagr:<id>:<id>" between two dated levels; a case may add "shock":"<id of a % input>" for a one-time cut. Code checks the inputs and computes the cases. Without both a cited level and a cited rate or two dated levels, write no block and say which input is missing.`,
    `### What would change this — the leading indicators to watch, each line opening "${REASONING}" or cited.`,
    '### Confidence and gaps — one honest line: how firm the view is and what no source gave.',
    'Do not write a Sources section; it is added from your citations.',
    `Rules: never state a forecast as fact unless a passage says it (then cite it and name who forecasts it, e.g. "according to [W3], X expects…"). Your own view is labelled "${REASONING}" and carries no figure. Prefer global figures to one country's; say which country a national figure is for. Never open with what the corpus lacks.`,
  ].join('\n');
}

/** Sentences that state a forecast as fact with nothing cited behind them. */
const FORECAST =
  /\b(will (reach|grow|rise|increase|decline|fall|drop|double|triple|exceed|hit|surge|soar|outstrip|remain|stay|be)|(is|are) (expected|projected|forecast|set|poised|likely) to|forecasts? (show|say|that)|by 20[3-9]\d\b)/i;
const CITED = /\[W\d+\]|\[[^\]]+\]\((https?:\/\/|\/)[^)]+\)/;
const LABELLED =
  /^\s*(?:[-*•>]\s*)?(?:\*\*|_)?(reasoning, not a sourced forecast|from general knowledge)/i;

export function uncitedForecasts(answer: string): string[] {
  const out: string[] = [];
  let fence = false;
  for (const line of answer.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence || /^\s*```|^\s*#|^\s*\|/.test(line) || LABELLED.test(line)) continue;
    for (const s of line.split(/(?<=[.!?])\s+/))
      if (FORECAST.test(s) && !CITED.test(s)) out.push(s.trim());
  }
  return out;
}

export function withoutUncitedForecasts(answer: string): string {
  let out = answer;
  for (const s of uncitedForecasts(answer)) out = out.split(s).join('');
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

/** The answer with its ```scenario block taken out and a placeholder in its place. */
export function takeScenarioBlock(answer: string, block: string): string {
  return answer.replace(block, PLACEHOLDER);
}

interface Section {
  title: string;
  body: string;
}

function sectionsOf(answer: string): { lead: string; sections: Section[] } {
  const parts = answer.split(/\n(?=#{2,4} )/);
  const first = /^#{2,4} /.test(parts[0]) ? '' : (parts.shift() ?? '');
  const sections = parts.map((p) => {
    const [head, ...rest] = p.split('\n');
    return { title: head.replace(/^#{2,4}\s+/, '').trim(), body: rest.join('\n').trim() };
  });
  // A "Bottom line" / "Summary" section, wherever it sits, is the bottom line: first, no heading.
  const at = sections.findIndex((x) =>
    /^(bottom line|summary|short answer|answer)\b/i.test(x.title),
  );
  if (!first.trim() && at >= 0) return { lead: sections.splice(at, 1)[0].body, sections };
  return { lead: first.trim(), sections };
}

const rank = (title: string) => {
  const i = SECTIONS.findIndex((s) => title.toLowerCase().startsWith(s.toLowerCase()));
  // An unknown section sits after "What drives it", where the model put its other findings.
  return i < 0 ? 1.5 : i;
};

/**
 * The answer in its shape: bottom line first, sections in order, the computed
 * scenario where the model's block was, the gaps said by code, Sources from
 * the citations. Pure.
 */
export function shapeAnswer(
  answer: string,
  opts: {
    scenario?: string;
    /** The model wrote a scenario block code could not compute: say why, once. */
    scenarioFailed?: boolean;
    unanswered: SubQuestion[];
    webCount: number;
  },
): string {
  const { lead, sections } = sectionsOf(answer);
  let body = [...sections].filter((s) => !/^sources?\b/i.test(s.title));
  const scenarioText = opts.scenario
    ? opts.scenario
    : opts.scenarioFailed
      ? 'No scenario is worked out: the cited passages did not print both a starting level and a growth rate for it.'
      : '';
  const at = body.findIndex((s) => /^scenarios?\b/i.test(s.title));
  if (scenarioText) {
    if (at < 0) body.push({ title: 'Scenarios', body: scenarioText });
    else if (body[at].body.includes(PLACEHOLDER))
      body[at] = { ...body[at], body: body[at].body.replace(PLACEHOLDER, scenarioText) };
    else body[at] = { ...body[at], body: `${body[at].body}\n\n${scenarioText}`.trim() };
  }
  body = body.map((s) => ({ ...s, body: s.body.split(PLACEHOLDER).join('').trim() }));
  if (opts.unanswered.length) {
    const line = `No page read for this answer gave: ${opts.unanswered.map((s) => s.ask.charAt(0).toLowerCase() + s.ask.slice(1)).join('; ')}.`;
    const i = body.findIndex((s) => /^confidence\b/i.test(s.title));
    if (i < 0) body.push({ title: 'Confidence and gaps', body: line });
    else body[i] = { ...body[i], body: `${body[i].body}\n\n${line}`.trim() };
  }
  body = body.filter((s) => s.body).sort((a, b) => rank(a.title) - rank(b.title));
  // The lead is the bottom line; with none, the first section's first paragraph
  // stands in — when the section keeps a paragraph of its own.
  let top = lead.split(PLACEHOLDER).join('').trim();
  const paras = body[0]?.body.split(/\n\n+/) ?? [];
  if (!top && paras.length > 1 && !/^\s*[|`-]/.test(paras[0])) {
    top = paras[0];
    body[0] = { ...body[0], body: paras.slice(1).join('\n\n') };
  }
  const cited = [
    ...new Set(
      [...answer.matchAll(/\[W(\d+)\]/g), ...(opts.scenario ?? '').matchAll(/\[W(\d+)\]/g)]
        .map((m) => Number(m[1]))
        .filter((n) => n >= 1 && n <= opts.webCount),
    ),
  ].sort((a, b) => a - b);
  if (cited.length) body.push({ title: 'Sources', body: cited.map((n) => `[W${n}]`).join(' ') });
  return [top, ...body.map((s) => `### ${s.title}\n\n${s.body}`)].filter(Boolean).join('\n\n');
}

/**
 * What the reader sees while the answer streams: everything but the
 * ```scenario block, which is JSON for code, not prose for a reader.
 */
export function scenarioStreamFilter(): { feed: (t: string) => string; flush: () => string } {
  const OPEN = '```scenario';
  let held = '';
  let inside = false;
  const feed = (t: string): string => {
    held += t;
    let out = '';
    for (;;) {
      if (inside) {
        const end = held.indexOf('```');
        if (end < 0) return out;
        held = held.slice(end + 3);
        inside = false;
        continue;
      }
      const start = held.indexOf(OPEN);
      if (start >= 0) {
        out += held.slice(0, start);
        held = held.slice(start + OPEN.length);
        inside = true;
        continue;
      }
      // Hold back a tail that could be the start of the fence.
      let keep = 0;
      for (let k = Math.min(OPEN.length - 1, held.length); k > 0; k--)
        if (OPEN.startsWith(held.slice(-k))) {
          keep = k;
          break;
        }
      out += held.slice(0, held.length - keep);
      held = held.slice(held.length - keep);
      return out;
    }
  };
  const flush = () => {
    const tail = inside ? '' : held;
    held = '';
    return tail;
  };
  return { feed, flush };
}
