/**
 * The two document pages: About and Thesis.
 *
 * Everything else on the site is a portal route under `app/` drawn from the
 * same config. These two are prose, so they stay in sitekit's section model.
 *
 * The pages this file used to hold — mandate, acting on it, disclosure,
 * participants, chokepoints — are gone. The first three described a firm with
 * staff, phases, a note schedule and a route to managing money, none of which
 * exists; what was true in them is now on About, said plainly. The last two
 * were lists that the portal renders better at /markets and /bottlenecks.
 *
 * Created: 2026-08-26
 */

import { COMPANY } from './substrata';
import {
  GLOSSARY,
  METHOD,
  STARTED,
  WHAT_EXISTS_NOT,
  WHAT_IT_IS,
  WHO_MAKES_IT,
} from './substrata-about';
import { INVESTMENT_THESIS } from './substrata-acting';
import { callsTesting } from './substrata-calls';
import { JOIN } from './substrata-join';
import { coverageProgress } from './substrata-coverage';
import { EVENTS } from './substrata-events';
import { evidenceProgress } from './substrata-evidence';
import { renderContribute } from '../lib/contribute';
import type { SiteChrome, SitePage } from './site-content';
import { SITE } from '../lib/site';

export function substrataSiteChrome(): SiteChrome {
  return {
    name: COMPANY.name,
    tagline: COMPANY.tagline,
    host: SITE.host,
    footerNote:
      `${COMPANY.name} is a public research project, not a firm. It does not trade, broker or ` +
      'quote, holds no position in anything it covers, and nothing here is an offer or ' +
      'investment advice. Rows without a source are marked unverified and are not findings.',
  };
}

// =====================================================================
// ABOUT
// =====================================================================

function aboutPage(): SitePage {
  const coverage = coverageProgress();
  const evidence = evidenceProgress();

  return {
    path: 'about',
    navLabel: 'About',
    title: 'About',
    intro: 'What this is, who makes it, and what it deliberately is not.',
    sections: [
      { kind: 'prose', paragraphs: [...WHAT_IT_IS] },
      {
        kind: 'stats',
        heading: 'Where it stands today',
        stats: [
          {
            label: 'Producer rows',
            value: `${coverage.sourced} of ${coverage.total}`,
            note: `verified · ${evidence.candidates} have a source found but unchecked`,
          },
          {
            label: 'Events recorded',
            value: String(EVENTS.length),
            note: 'each read and accepted by hand before publication',
          },
          {
            label: 'Building since',
            value: STARTED,
            note: 'one person and a set of AI agents, in public',
          },
        ],
      },
      {
        kind: 'definitions',
        heading: 'Who makes it',
        blurb:
          'Said plainly, because a research project that is vague about its own size is asking ' +
          'to be trusted for the wrong reasons.',
        items: WHO_MAKES_IT.map((item) => ({ term: item.term, detail: item.detail })),
      },
      {
        kind: 'definitions',
        heading: 'How a row gets here',
        items: METHOD.map((item) => ({ term: item.term, detail: item.detail })),
      },
      {
        kind: 'definitions',
        heading: 'What this is not',
        items: WHAT_EXISTS_NOT.map((item) => ({ term: item.term, detail: item.detail })),
      },
      {
        kind: 'definitions',
        anchor: 'plain-english',
        heading: 'Plain English',
        blurb: 'The terms this subject cannot avoid, in one line each.',
        items: GLOSSARY.map((item) => ({ term: item.term, detail: item.detail })),
      },
    ],
  };
}

// =====================================================================
// THESIS
// =====================================================================

function thesisPage(): SitePage {
  return {
    path: 'thesis',
    navLabel: 'Thesis',
    title: 'What follows from the map',
    intro: 'Six claims, each with the observation that would show it to be wrong.',
    sections: [
      {
        kind: 'prose',
        paragraphs: [
          'These are the views this research leans on. Each carries a falsifier: the thing ' +
            'that, if observed, would show it to be wrong. A claim without one cannot be scored, ' +
            'and a claim that cannot be scored is a slogan.',
          'This is a general view published to whoever reads it. It is not advice, it is not ' +
            'addressed to anyone in particular, and it takes no account of your circumstances.',
        ],
      },
      ...INVESTMENT_THESIS.map((claim) => {
        const calls = callsTesting(claim.id);
        return {
          kind: 'definitions' as const,
          heading: claim.claim,
          blurb: claim.detail,
          items: [
            { term: 'What would show this is wrong', detail: claim.falsifier },
            // A general view cannot be marked. The dated calls that bear on it
            // can, which is what stops this page being six opinions.
            ...(calls.length > 0
              ? [
                  {
                    term: `Tested by ${calls.length} dated call${calls.length > 1 ? 's' : ''}`,
                    detail: calls
                      .map((call) => `${call.claim} (resolves by ${call.resolveBy})`)
                      .join(' '),
                  },
                ]
              : []),
          ],
        };
      }),
    ],
  };
}

// =====================================================================
// JOIN
// =====================================================================

/**
 * The invitation to contribute. Its shape comes from `lib/contribute.ts`,
 * which is written to be copied into a sibling project unchanged — the model
 * is the part that differs, not the page.
 */
function joinPage(): SitePage {
  return {
    path: 'join',
    navLabel: 'Join',
    title: JOIN.title,
    intro: JOIN.lede,
    sections: renderContribute(JOIN),
  };
}

// =====================================================================

export function substrataSitePages(): SitePage[] {
  return [aboutPage(), thesisPage(), joinPage()];
}
