/**
 * What Substrata is, stated so that nothing on this site outruns the facts.
 *
 * This file exists because the previous version of the About copy described a
 * firm with analysts, desks, phases, a publication schedule and a practice of
 * declining business every week. None of that was true. Substrata is a
 * research project being built in public by one person with AI agents, and
 * every sentence here is checked against that.
 *
 * The rule, in one line: if a sentence would be false to a reader who knows
 * exactly how this is made, it does not go on the site. There is a test
 * (`test/truth.test.ts`) that fails the build on the phrases that broke it
 * last time.
 *
 * Created: 2026-09-15
 */

/**
 * Who a judgement on this site belongs to, said the same way everywhere a
 * score, a readiness level or an estimate is shown. Not "an analyst".
 */
export const JUDGED_BY = 'Substrata, open to challenge';

/** The day the first commit landed. Used wherever the site says how long this has run. */
export const STARTED = '2026-08-26';

export const WHAT_IT_IS = [
  'Substrata maps the bottlenecks on the path to much faster technological progress: the ' +
    'constraints that decide how quickly compute, energy, materials, robotics and manufacturing ' +
    'can actually be built. For each one it records why it binds, who makes it, what has ' +
    'happened to it lately, which rules govern it, and which technology could remove it.',
  'The research is free and public. Every row is either backed by a source you can open or ' +
    'marked as unverified, and the site shows which. That distinction is the whole product: a ' +
    'map of this kind is only worth reading if it is honest about what it has not checked.',
  'It is also open. If you work in one of these chains, the fastest way to change what this ' +
    'site says is to say so — every page carries a link that files the correction in public.',
];

export const WHO_MAKES_IT = [
  {
    term: 'An open project, not a private one',
    detail:
      'The data, the method, the code and the list of what has not been checked are all public. ' +
      'Anyone can read how a row got here, disagree with it in the open, and change it. That is ' +
      'the point of publishing rather than a side effect of it.',
  },
  {
    term: 'Contributors, and how to become one',
    detail:
      'The contributor list is short and the project is young. The parts that need expert ' +
      'knowledge — which firm ships the qualified grade, what a lead time really is, where an ' +
      'export control actually bites — are exactly the parts that cannot be settled from a desk. ' +
      'If that is your work, the Join page says which rows would benefit most.',
  },
  {
    term: 'Research assisted by software, checked by people',
    detail:
      'Automated agents search for sources and file candidates; they never publish. A person ' +
      'reads the source before a row is marked verified, and the site shows which rows have had ' +
      'that read and which have not. The automation widens the search. It does not lower the bar.',
  },
  {
    term: `Built in public since ${STARTED}`,
    detail:
      'The whole site is generated from files in a public repository, so its history is the ' +
      'commit log. Nothing is backdated, and every correction is visible as a commit.',
  },
  {
    term: 'Not a firm, not a fund',
    detail:
      'Substrata is a repository and a website. There is no legal entity, no licence, no trading ' +
      'desk, no fund, no client and no staff. It holds no position in anything it covers, is ' +
      'paid by nobody it writes about, and pays nobody.',
  },
  {
    term: 'No schedule',
    detail:
      'There is no note series on a calendar. Things are published when they are ready, and the ' +
      'dates are whatever the repository says they are.',
  },
];

/** The two tests a node must pass to enter coverage. Unchanged in substance, restated without the sales voice. */
export const METHOD = [
  {
    term: 'First test: does it move one of three curves?',
    detail:
      'Compute per joule, joules delivered, or actuation. A node that does not bear on one of ' +
      'those is out of scope, however interesting it is.',
  },
  {
    term: 'Second test: does it actually gate that curve?',
    detail:
      'Four questions: how few suppliers qualify, what happens if it disappears, how long from ' +
      'decision to new capacity, and whether the buyer can walk away at any price. Most of a ' +
      'supply chain is substitutable, and substitutable is not interesting.',
  },
  {
    term: 'Evidence has three states, and only one is a finding',
    detail:
      'Verified means a person opened a source that says so, and the link is on the page. ' +
      'Source found means an agent located a page that appears to say so and nobody has ' +
      'checked it yet. Unverified means neither. Only verified rows are findings.',
  },
  {
    term: 'Scores are judgements, and they are dated',
    detail:
      'Severity (0 to 12) and when a bottleneck bites are written by hand, carry the date they ' +
      'were judged, and sit next to a sentence explaining the call so a reader can disagree ' +
      'with it. They are not measurements.',
  },
  {
    term: 'Corrections are the point of publishing',
    detail:
      'If you work in one of these chains and a row is wrong, saying so makes the map better ' +
      'for whoever reads it next. Every page carries a link that opens a prefilled issue on ' +
      'GitHub. That is the only intake route, and it needs a GitHub account.',
  },
];

export const WHAT_EXISTS_NOT = [
  {
    term: 'Not advice, ever',
    detail:
      'Nothing here is an offer, a solicitation, a recommendation or investment advice. It is a ' +
      'general map published to whoever reads it, and it takes no account of anyone’s ' +
      'circumstances. Telling a particular person what to buy is a licensed activity that this ' +
      'project is not licensed for and does not do.',
  },
  {
    term: 'No prices, no lot sizes, no quotes',
    detail:
      'Substrata does not trade, broker, quote or arrange the movement of anything it covers. ' +
      'No page carries an indicative level, because a page that does reads as an invitation to ' +
      'deal whatever the small print says.',
  },
  {
    term: 'No positions to disclose',
    detail:
      'Substrata holds nothing. If that ever changes it will be said here first, before ' +
      'anything else is published. There is currently nothing to declare, and that is the ' +
      'declaration.',
  },
  {
    term: 'A track record that has only just started',
    detail:
      'A research project is worth what its past calls were worth. The first dated calls were ' +
      'published on 2026-09-15, each with the observation that settles it, and none has come ' +
      'due yet. So there is a record, it is empty, and no hit rate will be shown until enough ' +
      'calls have resolved for a percentage to mean anything. Wrong ones will stay on the page.',
  },
  {
    term: 'Out of scope on purpose',
    detail:
      'Nothing on the weapons or nuclear-fuel-cycle path is covered, and no page is written to ' +
      'help anyone acquire a controlled material. Several materials here are export-controlled; ' +
      'that is a fact about them and a reason to cover them carefully.',
  },
];

// The glossary moved to `substrata-glossary.ts` and renders at /learn, where
// each term has an anchor so anything on the site can link to a definition.
