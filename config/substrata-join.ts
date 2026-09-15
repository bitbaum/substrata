/**
 * Substrata's invitation to contribute.
 *
 * The model is `lib/contribute.ts`, which knows nothing about this project;
 * this file is the part that does. Every role below names a gap that actually
 * exists on the site today, with the page it would land on, so nobody writes
 * in about something already covered.
 *
 * The terms come first on the rendered page and they are not softened: this is
 * an open-source research project, not a job, and there is no money in it.
 * Saying that plainly is the difference between an invitation and a
 * recruitment advert that wastes somebody's afternoon.
 *
 * Created: 2026-09-15
 */

import { SITE } from '../lib/site';
import type { ContributeModel } from '../lib/contribute';

/** A prefilled issue, so the first message is already structured. */
function issue(title: string, body: string[]): string {
  const params = new URLSearchParams({
    title,
    labels: 'contribution',
    body: body.join('\n'),
  });
  return `${SITE.repo}/issues/new?${params.toString()}`;
}

export const JOIN: ContributeModel = {
  title: 'Join Substrata',
  lede: 'This map is wrong in places. If you know one of these chains, you can fix it faster than anyone here can.',
  intro: [
    'Substrata is an open research project mapping the constraints on building more compute, ' +
      'more power, better materials and better machines. Everything is public: the data, the ' +
      'method, the code, and the list of what has not been checked.',
    'It is early, and the parts that need expert knowledge are exactly the parts an outsider ' +
      'cannot verify from a desk. Which of five wafer makers actually ships prime 300 mm at ' +
      'volume. Whether a lead time quoted in a press release is the one a buyer really gets. ' +
      'Which step of a magnet supply chain the export controls actually bite on. People who do ' +
      'this work know those answers already.',
  ],
  terms: [
    {
      term: 'This is not a job and not employment',
      detail:
        'There is no vacancy, no contract, no salary and no obligation on either side. It is an ' +
        'invitation to contribute knowledge to an open-source project, in whatever amount suits ' +
        'you, and to stop whenever you like.',
    },
    {
      term: 'Nobody is paid, including the people running it',
      detail:
        'Substrata has no revenue and pays nobody. If that ever changes, this page will say so ' +
        'before anything else does.',
    },
    {
      term: 'Your contribution is public, and credited',
      detail:
        'Contributions arrive as public issues or pull requests under your own name, and the ' +
        'commit history is the record. If you would rather not be named, say so and the change ' +
        'goes in without attribution.',
    },
    {
      term: 'Do not send anything confidential',
      detail:
        'Everything here is public the moment it is filed. If a fact is under an agreement with ' +
        'your employer, it does not belong on this site. Published sources only.',
    },
  ],
  roles: [
    {
      title: 'People who work in a supply chain we cover',
      what:
        'Read the maker list for one material and tell us which rows are wrong, which firms are ' +
        'missing, and which of them actually ship the qualified grade rather than the commodity one.',
      why: 'About half of the 92 maker rows are unverified, and the unverified ones are exactly where trade knowledge beats desk research.',
      commitment: 'one-off',
      example: '/bottlenecks',
    },
    {
      title: 'Power and grid engineers',
      what:
        'Correct the transformer, interconnection and switchgear rows: real lead times, what a ' +
        'queue position actually means, and which reforms have changed anything on the ground.',
      why: 'Energy is where this research thinks the binding constraint sits, and it is the section with the least primary evidence.',
      commitment: 'occasional',
      example: '/bottlenecks?stage=energy',
    },
    {
      title: 'Semiconductor process and equipment people',
      what:
        'Check the lithography, packaging, memory and resist entries, and say where the severity ' +
        'scores are wrong and why.',
      why: 'These rows drive most of the map, and every score on them is currently one person’s judgement.',
      commitment: 'occasional',
      example: '/bottlenecks?stage=compute',
    },
    {
      title: 'Trade and export-control lawyers',
      what:
        'Check the policy entries against the instruments themselves: scope, status, what was ' +
        'suspended, and what a measure does rather than what the coverage of it said.',
      why: 'Five of the twelve rules were described wrongly in the first draft; a specialist would catch the next five faster.',
      commitment: 'occasional',
      example: '/policy',
    },
    {
      title: 'Materials scientists and process engineers',
      what:
        'Attach sources to the readiness judgements in the science section, or argue a number ' +
        'down with a reason.',
      why: 'Not one readiness score is cited yet. Every one of them is currently an argument rather than evidence.',
      commitment: 'one-off',
      example: '/science',
    },
    {
      title: 'People who can write clearly about hard things',
      what:
        'Write a note: what one part of the map implies, where the research is weak, or what a ' +
        'recent event actually changed.',
      why: 'The map states facts; the notes are where the reasoning gets argued with in public, and there are two of them.',
      commitment: 'occasional',
      example: '/notes',
    },
    {
      title: 'Engineers who want to work on the machinery',
      what:
        'Improve the research engine: better search, better candidate ranking, a policy sweep, ' +
        'or the scoring system that will judge this project’s own calls.',
      why: 'The automated sweep files candidates a person then reads. It is crude, and every improvement to it multiplies what one reader can verify.',
      commitment: 'ongoing',
      example: '/about',
    },
  ],
  routes: [
    {
      label: 'Correct a row on GitHub',
      href: issue('Correction: ', [
        '**Which row** (the page and the line):',
        '',
        '**What is wrong**:',
        '',
        '**Source** (a link that shows it — the row cannot change without one):',
        '',
      ]),
      whatHappens:
        'Opens a prefilled issue. It is read and either applied or answered in public, usually within a few days. Needs a GitHub account.',
    },
    {
      label: 'Offer your expertise',
      href: issue('Contribution: ', [
        '**What you work on**:',
        '',
        '**Which part of the map you could check**:',
        '',
        '**How much time you would want to give**:',
        '',
      ]),
      whatHappens:
        'Opens a prefilled issue describing what you know and which part you could check. You get a reply saying which rows would benefit most.',
    },
    {
      label: 'Send a pull request',
      href: `${SITE.repo}`,
      whatHappens:
        'Every fact on this site is a file in the repository. A change to a row is a change to a config file, and the tests will tell you if it breaks a rule.',
    },
  ],
  faq: [
    {
      question: 'I only have one fact. Is that worth sending?',
      answer:
        'Yes, and it is the most useful size of contribution. One corrected row from somebody who knows a chain is worth more than a general opinion about the whole map.',
    },
    {
      question: 'Can I contribute without being named?',
      answer:
        'Yes. Say so in the issue and the change goes in without attribution. The source still has to be public, because the row has to be checkable by the next reader.',
    },
    {
      question: 'Will this ever pay?',
      answer:
        'There is no revenue and no plan that depends on one. If that changes, this page changes first, and anybody who contributed before it changed will be told rather than discovering it.',
    },
    {
      question: 'What if I disagree with a severity score rather than a fact?',
      answer:
        'Say so. Every score carries the reasoning next to it precisely so it can be argued with, and an argument that changes a score is recorded like any other correction.',
    },
    {
      question: 'I work for one of the companies on the map. Is that a conflict?',
      answer:
        'It is worth disclosing in the issue, and it is not disqualifying. Send published sources rather than anything internal, and the disclosure travels with the change.',
    },
  ],
  credit:
    'Everything sent in arrives as a public issue or pull request, so the record of who improved what is the repository history rather than a page anyone here maintains. Corrections are the reason this research is published rather than kept.',
};
