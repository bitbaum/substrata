/**
 * A join / contribute page, as a typed model rendered through sitekit.
 *
 * WHY THIS SHAPE, AND WHY NOT A NEW PACKAGE
 *
 * Most projects here will eventually want a page that says "these are the
 * kinds of knowledge we need, here is how to offer yours, and no, this is not
 * a job". Five of the sibling repos have built one already and no two are
 * alike: one has an Apply button wired to nothing, one is an authentication
 * flow that happens to be called join, one is a full applicant tracker, one is
 * a static page with no way to reply at all.
 *
 * The fleet's own rule is that a shared package earns a dependency when it
 * removes a DECISION you keep re-making, and that behaviour is shareable while
 * markup is not. The decision here is what such a page must contain and what
 * it must never imply. The markup is sitekit's, already shared. So this file
 * is the decision, with no imports from this project in it: a pure function
 * from a model to `SiteSection[]`.
 *
 * TO REUSE IT IN ANOTHER PROJECT: copy this file and write your own model.
 * Nothing in here knows what Substrata is. When a third project wants it, this
 * is the file to lift into sitekit as `contributePage()` — at which point the
 * copies become an import and nothing else changes.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: an invitation to contribute is not an
 * offer of employment, and a page that blurs the two is a problem for whoever
 * reads it. `terms` is not optional, and `renderContribute` puts it above the
 * roles rather than in the small print at the bottom.
 *
 * Created: 2026-09-15
 */

import type { SiteSection } from 'sitekit';

/** How much of a commitment a contribution is. Deliberately a closed set. */
export type Commitment = 'one-off' | 'occasional' | 'ongoing';

export const COMMITMENT_LABEL: Record<Commitment, string> = {
  'one-off': 'A single correction',
  occasional: 'Now and then',
  ongoing: 'An ongoing part of the work',
};

export interface ContributionRole {
  /** The expertise, named as the person would name it themselves. */
  title: string;
  /** What they would actually do here, concretely. No verbs like "help shape". */
  what: string;
  /** Why this project needs it, in one line. Honest about the gap it fills. */
  why: string;
  commitment: Commitment;
  /** Where in the site this expertise would land, as a path. */
  example?: string;
}

export interface ContributionRoute {
  /** What the reader does. */
  label: string;
  href: string;
  /** What happens after they do it, so nobody is waiting on a reply that is not coming. */
  whatHappens: string;
}

export interface ContributeModel {
  /** Page title and the sentence under it. */
  title: string;
  lede: string;
  /** Two or three paragraphs: what this project is, why contribution is the point. */
  intro: string[];
  /**
   * What this is NOT. Required, and rendered before the roles.
   * Say it plainly: no employment, no pay unless there is pay, no obligation.
   */
  terms: { term: string; detail: string }[];
  roles: ContributionRole[];
  routes: ContributionRoute[];
  /** Questions a cautious person would actually ask before writing in. */
  faq?: { question: string; answer: string }[];
  /** Last line: what happens to what they send. */
  credit?: string;
}

/**
 * The model, as sitekit sections. Order is the argument: what this is, what it
 * is not, what is needed, how to offer it, then the questions.
 */
export function renderContribute(model: ContributeModel): SiteSection[] {
  const sections: SiteSection[] = [
    {
      kind: 'hero',
      eyebrow: 'Open research project',
      statement: model.lede,
      lead: model.intro,
      // Every route is a button here, so the page is usable from the top and
      // no destination is left as unclickable text further down.
      actions: model.routes.map((route) => ({ label: route.label, href: route.href })),
    },
    {
      kind: 'definitions',
      heading: 'Read this before you write in',
      blurb:
        'What an invitation to contribute is, and what it is not. Said first rather than in the small print.',
      items: model.terms,
    },
    {
      kind: 'cards',
      heading: 'Knowledge this project is short of',
      blurb:
        'Each of these is a real gap. If one of them is your day job, you can close it faster than anyone here can.',
      columns: 2,
      cards: model.roles.map((role) => ({
        title: role.title,
        body: `${role.what} ${role.why}`,
        meta: COMMITMENT_LABEL[role.commitment],
      })),
    },
    {
      kind: 'cards',
      heading: 'What happens when you write in',
      blurb:
        'The routes above, and what follows each one — so nobody is left waiting on a reply that was never coming.',
      columns: 3,
      cards: model.routes.map((route) => ({
        title: route.label,
        body: route.whatHappens,
        meta: hostOf(route.href),
      })),
    },
  ];

  if (model.faq && model.faq.length > 0) {
    sections.push({
      kind: 'faq',
      heading: 'Questions',
      items: model.faq,
    });
  }

  if (model.credit) {
    sections.push({ kind: 'prose', heading: 'Credit', paragraphs: [model.credit] });
  }

  return sections;
}

/** Where a route goes, for the reader who wants to know before clicking. */
function hostOf(href: string): string {
  if (href.startsWith('mailto:')) return 'by email';
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return 'on this site';
  }
}

/**
 * The checks a contribute page has to pass. Exported so each project can run
 * them in its own test suite rather than discovering the failure on the page.
 */
export function validateContribute(model: ContributeModel): string[] {
  const problems: string[] = [];
  if (model.terms.length === 0) {
    problems.push('terms is empty: a contribute page must say what it is not');
  }
  const termText = model.terms
    .map((t) => `${t.term} ${t.detail}`)
    .join(' ')
    .toLowerCase();
  if (!/not (a job|employment|an employment|a contract)/.test(termText)) {
    problems.push('terms never says plainly that this is not employment');
  }
  if (model.roles.length === 0) problems.push('roles is empty: nothing is being asked for');
  for (const role of model.roles) {
    if (role.what.length < 30) problems.push(`role "${role.title}": what is too vague`);
    if (role.why.length < 20) problems.push(`role "${role.title}": why is too vague`);
  }
  if (model.routes.length === 0) problems.push('routes is empty: there is no way to respond');
  for (const route of model.routes) {
    if (!/^(https?:\/\/|\/|mailto:)/.test(route.href)) {
      problems.push(`route "${route.label}": href is not a link`);
    }
    if (route.whatHappens.length < 20) {
      problems.push(`route "${route.label}": does not say what happens next`);
    }
  }
  return problems;
}
