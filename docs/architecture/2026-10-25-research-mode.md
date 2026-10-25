# Research mode: analytical and forward-looking questions

Decided 2026-10-25. Extends [the open-web Ask](./2026-10-24-open-web-ask.md) and
[the research systems note](./2026-10-24-research-systems.md) (the ladder in §1 and the
evidence grades in §2 hold unchanged). This note does not edit either.

## Why

The owner, 2026-10-25: "if I ask you, what do you think will be the demand on neon in the
future? You should be able to give me a good response with links, with everything. I'm not
even trying to ask that question because I'm pretty sure Substrata will fail at giving me a
substantial response."

Asked on production the same day, "What do you think will be the demand for neon in the
future? Give sources." got a US-only paragraph (USGS apparent consumption 180 → 230 million
litres, 2021–2025), one line on semiconductors, a TSMC event and a producer list. Six pages
had been read and almost nothing from them was used: no global picture, no drivers
quantified (wafer starts, the DUV/EUV mix, the 2022 Ukraine shock and its recovery, China's
capacity, recycling), no scenarios, no assumptions, no uncertainty.

The cause was the shape of the path, not the model: one search of the question's own words,
four pages, passages chosen by the question's words, and a prompt shaped for a lookup.

## The policy

1. **Routing** (`lib/chat-agent/route.ts`, `isAnalysis`). A question is `analysis` when it
   asks about the future or a counterfactual or the effects of something: outlook, forecast,
   projection, prospects, long-term, "in the future", "by 2035", "what will", "what do you
   think", "what would/could happen", "what happens to/if", "what if", "if X is cut/banned",
   "what would X do to Y", implications, scenarios, "compare … impact/effects/over time",
   "impact of … controls/bans/sanctions", "when could … be commercial/available/viable". It
   is decided in code from the words, before anything is fetched. Questions about news,
   guidance, prices today or what someone said stay on the open-web path. Research mode
   needs the web; with no search backend configured the ordinary path answers.
2. **Plan** (`research-plan.ts`). One model call returns JSON: a subject, 3–6
   sub-questions with one search query each, and optional corpus lookups. Code validates
   it: ids and queries de-duplicated, at most six sub-questions, corpus tools only from a
   short list (`find_numbers`, `resource_production`, `producers_in`, `related_to`,
   `restrictions_on`, `sanctions_on`, `scenario_impact`, `get_bottleneck`,
   `relief_technologies`), each with only the arguments the tool declares and its required
   ones present, at most four. No valid plan within 7 s (no JSON, too few sub-questions, a
   refusal, a timeout) → the plan built in code from the question's kind (outlook, what-if,
   compare, when), so a bad plan never costs the reader a wait. For neon the code plan is:
   global supply and producers; demand drivers by end use and growth; supply shortage and
   new capacity; price history; published forecasts.
3. **Read** (`research-read.ts`). Every sub-question is searched at once through the same
   `lookUp` the open-web path uses (SearXNG first, free; `readPage` with its SSRF check on
   every redirect hop, PDFs through `chat-web-pdf.ts`, 6 s and 1.5 MB per page, four pages
   per search). One deadline bounds the whole read (15 s): what is back by then is what the
   answer is written from. Passages are kept round-robin across sub-questions (each gets
   its best page before any gets a second), one URL once, at most two pages per site, read
   pages before snippets, official, trade and analyst publishers before market-report
   farms and aggregators, dated before undated — 14 at most. Each is a `[W#]` in the ledger
   (so the reader's chips and "Web pages read" list show it) and in one `[web_search]`
   result (so every existing web guard reads it). The corpus lookups the question and the
   plan name run beside the read.
4. **Write** (`research-shape.ts`, `researchInstruction`). One call, streamed, in this shape:
   - a direct 2–3 sentence **bottom line** first, no heading, its figures cited;
   - **What is established** — cited facts with numbers and dates, global before national;
   - **What drives it** — each driver quantified where a passage quantifies it, cited;
   - **Scenarios** — low/base/high as labelled reasoning; the model writes the framing and
     a `scenario` JSON block of inputs and cases, never a scenario number (below);
   - **What would change this** — leading indicators;
   - **Confidence and gaps** — one honest line;
   - **Sources** — built by code from the `[W#]` the answer cites (chips on screen).
   The model's own view is labelled "Reasoning, not a sourced forecast:" and, like marked
   general knowledge, carries no figure and no supplier, buyer, owner or financier link.

## The guards

Every guard of the ordinary path runs unchanged (`check-answer.ts`): the wall, figures from
nowhere, units and printed forms, a figure in a `[W#]` sentence must be in that passage
(`web-figures.ts`), default deny, nothing made up on a missing link, no internals, and the
answer never opens with what the corpus lacks (`open-first.ts`). Added, none weakening one:

- **Scenario numbers are code's** (`scenario-calc.ts`). The model names inputs (a value,
  a unit, a year, the `[W#]` it comes from) and cases (`flat`, a cited `%` rate, or
  `cagr:<a>:<b>` between two dated cited levels, optionally a one-time `shock` by a cited
  `%`). An input is used only if the passage it cites prints that number; a case resting on
  any other input is dropped; fewer than two computable cases → no scenario, said in one
  line and filed as a gap (`research:scenario-inputs`). Code computes every case and shows
  the arithmetic (`230 × (1 + 6.3%)^5 = 312`), lists the inputs with their citations and the
  assumptions, says which inputs were left out and why, and draws a chartkit line chart
  through the chatkit `chat_ui` chart block — captioned as reasoning, not a sourced
  forecast. The block is inserted after the checks, so no guard ever reads a computed
  number as a claim, and it is kept off the reader's screen while it streams.
- **No uncited forecast stated as fact.** A sentence saying something *will* reach, grow,
  fall or double, *is expected/projected/set to*, or *by 2030*, with no `[W#]` or link and
  no reasoning label, is removed. A forecast a source makes stays, said as theirs.
- **Reasoning sections** ("Scenarios", "What would change this", "Confidence and gaps")
  hold their uncited lines to the labelled-background rule in default deny: no figure, no
  link claim.
- **Gaps are said and filed by code.** Every sub-question no kept passage answers is named
  once under "Confidence and gaps" ("No page read for this answer gave: price history.")
  and filed through `gaps.ts` as `research:<id>` with the subject — demand for research
  work, as rung 6 of the ladder asks.

## Budget

| | Open-web path | Research mode |
|---|---|---|
| Model calls | 1 (+ guard send-backs) | 2: one plan, one answer (+ the same guard send-backs; + one continuation if the answer hits its output limit) |
| Searches | 1 (2 with a missing link) | 3–6, in parallel |
| Pages read | 4 | up to 4 per search, ≤ 24, in parallel; 14 passages kept |
| Wait before writing | the search and its pages (≈ 6–12 s) | plan ≤ 7 s, then search and pages ≤ 15 s: at most ≈ 10 s more than the open-web path |
| Output allowance | 2,400 tokens (free) / 4,096 (own key) | 3,600 / 6,000; writing timeout 40 s on the free chain |

Extra cost per research question: one short planning call (the prompt is ≈ 300 tokens,
the reply a few hundred), a writing prompt larger by the extra passages (≈ 4,000 tokens
more input than the open-web path) and a longer answer. Searches cost nothing on SearXNG;
no paid search API is used or required. Both calls go through the same `ModelTurn` as the
rest of the Ask: the free chain, or the reader's own key and model when they bring one, on
the same terms and against the same per-reader limits.

## Not verified here

The sandbox that built this has no model and no SearXNG. Every test uses fakes
(`test/research-mode.test.ts`, `test/research-run.test.ts`, the five research rows in
`test/ask-evals.json`). After deploy, `pnpm exec tsx scripts/ux/ask-live.ts` asks the five
questions on production and writes what came back to `scripts/ux/reports/`.
