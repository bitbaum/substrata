/**
 * The claims this research leans on, each with the observation that would show
 * it to be wrong.
 *
 * A view without a falsifier cannot be scored, and a view that cannot be
 * scored is a slogan. These render at /thesis.
 *
 * This file used to also hold routes for acting on the research and a ledger
 * of what it would take to manage money. Both described a different project —
 * one with a licence, an entity and clients — and both edged toward advice.
 * They are gone. What is true about the limits of a public research page is
 * on /about.
 */

// nobody wrote down cannot be scored.
// =====================================================================

export interface ThesisClaim {
  id: string;
  claim: string;
  detail: string;
  /** What would show this to be wrong. A thesis without one is a slogan. */
  falsifier: string;
}

export const INVESTMENT_THESIS: readonly ThesisClaim[] = [
  {
    id: 'bottleneck-migrates',
    claim: 'The bottleneck is rarely where the attention is.',
    detail:
      'Attention, and therefore price, concentrates on the visible layer — the model, ' +
      'the accelerator, the hyperscaler. The binding constraint usually sits one or two ' +
      'layers below it, in a company nobody writes about. The gap between where a chain ' +
      'is priced and where it actually binds is the whole reason to map it.',
    falsifier:
      'If constraints resolved at the visible layer — if compute output tracked chip ' +
      'design announcements rather than packaging, power and tooling — the map would be ' +
      'describing a chain that no longer gates anything.',
  },
  {
    id: 'chokepoints-are-not-commodities',
    claim: 'A chokepoint does not price like a commodity.',
    detail:
      'When both demand and supply are inelastic, price is set by scarcity rather than ' +
      'by cost of production, and it moves in jumps. Cost-plus intuition — the instinct ' +
      'that says a material cannot be worth many times its input cost — systematically ' +
      'misprices exactly the nodes covered here.',
    falsifier:
      'Sustained periods where chokepoint prices track production cost, with substitution ' +
      'or new entry arriving fast enough to cap them.',
  },
  {
    id: 'energy-binds-first',
    claim: 'This decade, energy binds before silicon does.',
    detail:
      'Compute is being announced faster than it can be energised. Transformer order ' +
      'books, interconnection queues and turbine slots clear on a slower clock than fab ' +
      'construction, and none of them can be accelerated with capital alone.',
    falsifier:
      'Interconnection queues and transformer lead times shortening while announced ' +
      'datacentre capacity keeps rising — energy ceasing to be the thing that slips.',
  },
  {
    id: 'substitution-is-slow',
    claim: '“There is an alternative” is usually false on the horizon that matters.',
    detail:
      'Qualification is measured in years: a second-source material, tool or resist has ' +
      'to be proven per process, per fab, per application. A substitute that exists in a ' +
      'laboratory and a substitute that is qualified are different facts, and only the ' +
      'second one relieves a constraint.',
    falsifier:
      'Qualification cycles compressing materially — second sources reaching production ' +
      'in quarters rather than years.',
  },
  {
    id: 'concentration-is-political',
    claim: 'Supply concentration is now a policy variable, in both directions.',
    detail:
      'Export controls made geography a first-order term in these chains. That cuts both ' +
      'ways: restriction raises the value of what is restricted, and subsidised ' +
      're-shoring can destroy the scarcity that made a node interesting in the first place.',
    falsifier:
      'A durable de-escalation in which controls are lifted and re-shoring programmes ' +
      'deliver qualified capacity at scale.',
  },
  {
    id: 'the-map-compounds',
    claim: 'The map compounds. A position does not.',
    detail:
      'Any single view can be wrong and is eventually closed. Knowing every qualified ' +
      'producer of a material, and being told when a row is wrong by someone who works ' +
      'in that chain, is an asset that accumulates. That is why the research is ' +
      'published rather than sold, and why it comes before any book.',
    falsifier:
      'The map failing to attract corrections — no practitioner engagement — which would ' +
      'mean it is not compounding, only ageing.',
  },
];
