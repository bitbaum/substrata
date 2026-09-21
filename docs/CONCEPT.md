# What Substrata is for, and who it is better than

Written 2026-09-21. This is the strategy document: what the corpus is
becoming, why it beats the industry it most resembles, who would pay for it,
and the rules that keep a holistic map from degenerating into a general
database. `DATA-MODEL.md` says what to build next in the data; this says why,
and for whom.

It is a working document, not a claim about what exists. Everything in
"Where this goes" is unbuilt.

---

## 1. The pigeonhole, and the way out of it

The nearest recognisable thing to Substrata is sell-side equity research, and
that comparison is both the best available marketing and the worst available
ceiling.

Best, because equity research is a known quantity with a known price, and
"better than equity research" is a claim a buyer can evaluate in ten minutes.
Worst, because equity research is a product shaped by a distribution business
— coverage allocated by banking relationship, output shaped for a portfolio
manager's quarter — and inheriting its shape means inheriting its limits.

The resolution is not to choose. **Equity research is a projection of this
corpus, not its purpose.** The corpus is a causal map of the physical
constraints on technological progress. Point it at a share register and it
produces equity research; point it at a purchase order and it produces
supply-chain risk; point it at a grant programme and it produces science
policy; point it at a term sheet and it produces deep-tech diligence. One
corpus, several renderings, and the renderings are cheap once the join is
right.

So: publish the equity-research rendering free, forever, as the proof and the
advertisement. Sell the renderings that answer *what do I do about this
constraint* rather than *what do I buy*. Section 7 says who those buyers are.

---

## 2. Why the incumbent is beatable

Not because its analysts are weak. Because the product has five structural
faults, each of which is a consequence of how the business is funded, and each
of which this corpus already has the opposite of.

**1. The unit of analysis is a ticker; the unit of causation is a node.**
Constraints do not respect share registers. The binding node is regularly a
private company, a state enterprise, a single plant inside a conglomerate, a
machine with an annual output in single digits, or a person who knows how to
run a furnace. Sell-side research structurally cannot cover what cannot be
bought — not from cowardice, from purpose. `NODE_TYPES` in `substrata.ts`
already says material, company, person, machine, process. That list is the
whole argument, written before it was argued.

**2. Coverage is allocated by market capitalisation, not by causal weight.**
Dozens of analysts publish on the visible layer. Nobody publishes on the
qualified suppliers of crucible-grade quartz, which gates the visible layer.
This is exactly the `bottleneck-migrates` thesis claim, restated as an
industrial-organisation fact about the competitor.

**3. The horizon is a quarter; the constraints clear on a decade.**
Qualification cycles, mill construction, interconnection queues and
export-control regimes run three to ten years. There is no sell-side format
for "this binds in 2029, and here is the paper trail that says so." There is
one here: `CALLS`, with a resolution date and a named settling observation.

**4. Sector silos cut across every interesting chain.** Helium ties quantum
computing to a handful of gas fields to a strait. Dysprosium ties robotics to
one country's refining capacity to an export-licence regime. The join is the
finding, and no sell-side organisation chart produces it because the semis
analyst, the utilities analyst and the chemicals analyst file separately.

**5. It cannot be scored, and does not try.** Ratings are unfalsifiable and
price targets roll forward. A published ledger of dated predictions, resolved
right *and* wrong, is cheap here and career-ending there. `substrata-calls.ts`
is the most competitively significant file in the repository, and it currently
holds a handful of rows. That is the gap between the idea and the asset.

---

## 3. The one idea: a constraint, observed at five latencies

This is the thing to build the product around, because it is the part that is
genuinely hard to copy and genuinely useful.

Every bottleneck is visible in five different record systems, and each system
sees it at a different remove in time:

| Layer | What it records | How far ahead it sees | Example observable |
| --- | --- | --- | --- |
| **Science** | whether relief is physically possible, and who is working on it | 5–15 years | a paper, a lab, a principal investigator, a patent family |
| **Funding** | who has committed money to which relief, at what stage | 2–7 years | a public grant award, a Series B, a national programme |
| **Talent** | where the process knowledge is, and where it just moved | 1–5 years | a hire, a spin-out, a plant's staffing |
| **Policy** | whether the thing is permitted, subsidised or embargoed | 0–3 years | an instrument, a licence regime, a tariff schedule |
| **Market** | what it costs and how long the queue is | 0–1 year | a lead time, a price, a capacity announcement |

Equity research reads the last row and, on a good day, the second-to-last.
Everything above is treated as colour.

**The product claim, stated precisely: the corpus sees a constraint move in
the upper rows years before it prices in the bottom one, and it can show its
working.** A grain-oriented electrical steel substitute is not a market story
in 2026; it is a set of dated readiness judgements, three named laboratories,
a funded national programme and a qualification cycle nobody has started. That
is a 2031 market story that is *already fully observable*, and nothing
currently sold to investors is organised to see it.

This reframes each of the user-facing domains the corpus already has —
science, capital, policy, markets, talent — from "more dimensions" into
"the same constraint at five latencies". More dimensions is a database. The
same constraint at five latencies is a thesis, and it is what makes the
holism earn its keep instead of dilute the map.

### What it demands of the data model

Every observation must be typed by its layer and carry its own two dates: when
the thing happened, and when it was recorded here. Lead time — the gap between
those and the market's eventual recognition — is then a *derived, measurable*
property of the corpus rather than a boast.

```ts
type Layer = 'science' | 'funding' | 'talent' | 'policy' | 'market';

interface Observation {
  layer: Layer;
  /** The bottleneck(s) it bears on. An observation attached to nothing is not kept. */
  gates: EntityId[];
  /** Does it tighten the constraint, loosen it, or neither? */
  effect: 'tightens' | 'loosens' | 'neutral';
  /** The date the thing happened, per the source. Never the fetch date. */
  occurredOn: string;
  /** The date this corpus first recorded it. Git is the proof. */
  recordedOn: string;
  sources: string[];
}
```

`CoverageEvent` in `substrata-events.ts` is three-quarters of this already. It
needs the layer, and it needs to stop being only a news feed: a grant award
and a professorship are events in exactly the same sense as an export control.

---

## 4. Where this goes: five additions, in order of leverage

### A. Exposure — the join that makes the equity rendering fall out for free

The single highest-leverage missing edge. A company is not "a semiconductor
company"; it is *some fraction of its revenue and some larger fraction of its
risk* attached to specific nodes.

```ts
interface Exposure {
  company: EntityId;
  bottleneck: EntityId;
  /** Which side: does the company supply the node, or depend on it? */
  side: 'supplies' | 'depends';
  /** Fraction of revenue, where a filing says so. Absent is honest; invented is not. */
  share?: { value: number; year: number; basis: 'reported' | 'estimated'; source: string };
  /** Why this matters beyond the share — a 2% line that gates the other 98%. */
  why: string;
  sources: string[];
}
```

With this edge and a securities spine on the company entity (listing, ticker,
ownership, state control), three queries that nobody can currently answer
become one-liners:

- *Who is listed and exposed to dysprosium, and for how much of their revenue?*
- *Which nodes on the critical path have no listed exposure at all?* — the
  answer is the reason this is not equity research.
- *Where is the market pricing the visible layer while the binding node sits
  in a private company nobody covers?* — the `bottleneck-migrates` claim,
  turned from an assertion into a query result.

### B. Science with names on it

`substrata-science.ts` holds reliefs with a readiness judgement. It does not
hold who is doing the work. That is the layer with the longest lead time and
it is currently anonymous, which is the one thing the top row of the table in
section 3 cannot afford to be.

New entity kinds, following the existing one-file-per-kind adapter pattern:
`lab`, `person`, `programme` (a funded research programme, distinct from the
existing commissioned-question `ResearchProgramme` — rename one of them before
they collide).

```ts
interface Work {
  /** A paper, a patent family, a grant, a facility commissioning. */
  kind: 'paper' | 'patent' | 'grant' | 'facility';
  title: string;
  by: EntityId[];               // people, labs, companies
  relieves: EntityId[];         // science entries, and through them bottlenecks
  occurredOn: string;
  /** For a grant: the money and its term. The most underused dated signal there is. */
  amount?: Quantity;
  through?: string;
  sources: string[];
}
```

Sources that are free, structured, dated and legally usable: **OpenAlex**
(works, authors, institutions), **EPO/Espacenet** and the USPTO bulk data
(patent families), **NSF, DOE, Horizon Europe, UKRI and NEDO award databases**
(funded, dated, named principal investigator, stated objective).

The grant databases deserve the emphasis. A national award is a *dated,
funded, publicly documented commitment by named people to attempt a specific
relief, three to five years before anything ships.* It is the cleanest leading
indicator in the whole model, it is free, and essentially nobody in finance
reads it systematically.

### C. Talent as a subject, not as a recruiting page

`lib/entities/sources/talent.ts` currently builds entities out of *this
project's* open roles. That is a contribution page wearing the talent kind's
clothes. The research subject is different and more valuable: where process
knowledge lives, and where it just moved. A second source for a material
becomes real when the people who know how to run the line arrive at the second
site — and that is observable, from public postings, from filings, from
conference rosters, from the labs in section B.

Keep the contribution page. Move it out of the entity kind, and give the kind
its actual subject.

### D. Numbers, concentration and the derived reads

Already specified in `DATA-MODEL.md` sections A and C, still the right next
move, and now with a second reason: a Herfindahl concentration computed from
production shares is the numeric form of the first chokepoint test. When the
numbers exist, the 0–12 binding judgement stops carrying weight it was never
designed to carry, and the corpus starts being able to disagree with itself —
a judgement of 11 sitting beside a measured concentration of 0.3 is a
research lead.

### E. Calls, at volume, with the sweep proposing them

A handful of predictions is a hobby. The mechanism that turns the corpus into
a track record is: the sweep proposes a call whenever an observation in the
upper layers implies a dated, checkable consequence in the market layer; a
person accepts or rejects it; the resolution is scored in public, misses
included. Machine-proposed, human-accepted, publicly marked. That is a
credibility engine no competitor can run, because their incentive is to never
be seen wrong.

---

## 5. The rule that keeps holism from becoming a general database

This is the biggest risk in the whole plan, and the corpus has already
demonstrated it once: `DATA-MODEL.md` records that 30 of 51 country rows
connected to no bottleneck at all, producing a general commodities directory
wearing this project's clothes.

Ambition to be holistic *is* the failure mode. The defence has to be
mechanical, not editorial:

> **Every row must reach a loop.** An entity that cannot be traversed —
> through relations already in the registry — to at least one bottleneck, and
> through that bottleneck to at least one loop in `lib/kpi/loops.ts`, is not
> part of the research. It is either given the connection with a source, or
> fenced behind an explicit "context, not research" boundary, or deleted.

Make it a test that fails the build, in the manner of `truth.test.ts`. An
orphan-row gate is worth more to the quality of this corpus than any amount of
additional collection, because it converts "is this relevant?" from a matter
of taste into a matter of CI.

The corollary is the answer to *how much is too much*: the corpus may grow
without limit in depth along the chains it already touches, and may not grow
one row sideways into a subject that does not gate a loop. Oil is out. Gold is
out. Helium is in because 4 K is in.

---

## 6. What "better than equity research" means, made measurable

A claim that cannot be scored is a slogan — the same rule this project already
applies to its own thesis. Three metrics, all computable from the corpus, all
publishable:

1. **Uncovered-node share.** Of the nodes judged binding today, what fraction
   has no listed pure-play at all? That number is the size of the blind spot
   in the incumbent product, and it is very likely a large majority. Computable
   the day the `Exposure` edge exists.
2. **Lead.** Median days between `recordedOn` here and the first appearance of
   the same fact in the market layer — a price move, a lead-time revision, a
   sell-side note. This measures the section 3 claim directly. It requires
   honest bookkeeping and it is the single most persuasive number this project
   could ever publish.
3. **Resolved call record.** Hit rate with misses displayed, published only
   once the sample means something — the rule already written into
   `substrata-calls.ts`.

If those three numbers are good, the comparison is won on evidence rather than
adjectives. If they are bad, the strategy is wrong and the corpus says so
first. That is the point.

---

## 7. Who this is for

Ranked by fit — meaning willingness to pay, tolerance for a young corpus, and
whether serving them *improves* the map rather than just extracting from it.

**1. Procurement, supply assurance and strategy inside industrials, energy
developers and large compute buyers.** Their question is operational: *who
else is qualified for this grade, what is the real lead time, what happens to
us if this route closes.* They have budget lines for exactly this, no
incumbent serves them well (consultancies sell projects, not a maintained
map), and — decisively — **they will correct the data**, because they are the
people who actually know. Every other customer extracts from the corpus. This
one feeds it. That makes them the anchor even where the cheque is not the
biggest.

**2. Deep-tech and climate-tech investors, and their limited partners.** The
science-and-readiness half of the corpus is a diligence product as it stands:
*is this relief real, at what stage, who else is attempting it, what has to
qualify before it can ship.* Short sales cycle, high perceived value,
and it exercises exactly the layers that most need building out.

**3. Long-horizon public-market capital — specialists, family offices,
endowments, strategics.** Not the pod shops: a two-week edge is not what this
produces and pretending otherwise would lose the only customer whose horizon
matches. The right buyer holds for years and wants the private-company map and
the upper-layer signal. This is where the equity rendering monetises, and it
monetises *because* it is not equity research.

**4. Government, development finance and security-adjacent institutions.**
`substrata-policy.ts` is already half a product for them. Long sales cycles,
large cheques, and the legitimacy makes everything else easier. Worth
positioning for, not worth chasing yet.

**5. Insurers and reinsurers writing supply-chain interruption.** A genuine
unserved need for exactly this data structure. Parked, noted, real.

Journalists, academics and practitioners are not customers. They are the
distribution and the correction flywheel, and they get everything free.

The pattern in the ranking: the best customers are the ones whose question is
*what do I do about this constraint*. Equity research answers *what do I buy*,
which is the narrowest and most regulated slice of the addressable demand, and
the one this project is least free to serve today — there is no licence, no
entity, and no position. Anchoring the business on it would be choosing the
one rendering that is both smallest and hardest.

---

## 8. How it pays, without becoming something it is not

The corpus stays open. That is not idealism: an open map is the only kind that
gets corrected by the person who runs the winding shop, and the corrections
are the moat. `the-map-compounds` says this already.

What can be charged for, in rough order of how soon it is real:

- **Answers on deadline.** A specific question, researched against the corpus,
  delivered by a date. `RESEARCH_PROGRAMMES` already models the shape.
- **Monitoring.** *Tell me when anything changes for these twelve nodes.* The
  sweep exists, the events pipeline exists, marginal cost is near zero, and
  the value compounds with coverage. This is the subscription.
- **Structured access.** `/api/map` already exists. Licensed, versioned,
  documented access to the graph for buyers who want it inside their own
  systems.
- **Diligence renderings** for customer 2, which are mostly the science and
  readiness modules with a covering judgement.

Not now, and the repository should keep saying so: no prices, no advice, no
positions, no desk. Note that none of the four items above requires a licence
— another argument for not anchoring on the one rendering that does.

---

## 9. Order of work

1. **The orphan-row gate** (section 5). Cheapest, and it protects everything
   after it.
2. **`Observation.layer` and the two dates** (section 3) — retrofit
   `CoverageEvent`. Small change, and the whole thesis hangs off it.
3. **`Exposure`** (section 4A) plus the securities spine on companies. This is
   what makes the equity rendering fall out of the corpus rather than be
   written by hand.
4. **Quantities and concentration** (section 4D / `DATA-MODEL.md`) — the
   numbers a reader asks for first.
5. **Science with names** (section 4B): OpenAlex and the grant databases,
   `lab` and `person` kinds, the `Work` record. The longest-lead layer and the
   most defensible.
6. **Talent as a subject** (section 4C).
7. **Calls at volume, machine-proposed** (section 4E), and the three metrics
   in section 6 computed and published.

---

## 10. What this deliberately does not become

- A general commodities or macro database. See section 5.
- A terminal. Breadth without causation is the incumbent's failure, not a
  target to match.
- A newsletter with a view. The corpus is the product; prose is a rendering.
- A firm with staff, a desk, a schedule or positions, in anything it publishes,
  until each of those is true. `test/truth.test.ts` enforces this and should
  keep doing so as this document's ideas reach the site.
