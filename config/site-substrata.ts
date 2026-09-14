/**
 * Substrata's website, generated from its OrangeCat profile.
 *
 * Every word and number below comes from `substrata.ts` and
 * `substrata-coverage.ts` — the same objects the group profile, the product
 * catalogue and the Cat read. There is no second copy of the mandate, no
 * duplicated price list, and no separately-maintained "about" text. Change the
 * profile and the website changes with it, which is the whole claim /domains
 * is making when it says a profile can spin up a working site.
 *
 * That constraint is also why the site is honest: the coverage page cannot
 * quietly present unsourced research leads as findings, because the only data
 * it has is the same data the tests hold to `source: null`.
 *
 * Created: 2026-08-26
 */

import {
  CHOKEPOINT_TEST,
  COMPANY,
  DISCLOSURE,
  EXCLUSION_RULE,
  MANDATE_CURVES,
  MATERIALS,
  NODE_TYPES,
  PHASES,
  SCOPE,
} from './substrata';
import {
  ACTING_LIMITS,
  ACTION_ROUTES,
  INVESTMENT_THESIS,
  READINESS,
  READINESS_STATUS_LABEL,
  readinessProgress,
} from './substrata-acting';
import {
  CHAIN_LAYERS,
  SCARCITY_DETAIL,
  SCARCITY_LABEL,
  bindingParticipants,
  participantProgress,
  participantsInLayer,
} from './substrata-participants';
import { CHOKEPOINTS, NODE_TYPE_LABEL, chokepointProgress } from './substrata-coverage';
import type { SiteChrome, SitePage, SiteSection } from './site-content';
import { SITE } from '../lib/site';

export function substrataSiteChrome(): SiteChrome {
  return {
    name: COMPANY.name,
    tagline: COMPANY.tagline,
    host: SITE.host,
    footerNote:
      `${COMPANY.name} publishes research. It does not trade, broker or quote, holds no ` +
      'position in anything it covers, and nothing here is an offer or investment advice. ' +
      'Rows marked unverified are research leads, not findings.',
  };
}

// =====================================================================
// MANDATE
// =====================================================================

function mandatePage(): SitePage {
  return {
    path: 'mandate',
    navLabel: 'Mandate',
    title: 'Mandate',
    intro: EXCLUSION_RULE.rule,
    sections: [
      { kind: 'prose', paragraphs: [EXCLUSION_RULE.explainer] },
      {
        kind: 'cards',
        heading: 'Three curves',
        columns: 3,
        cards: MANDATE_CURVES.map((curve) => ({
          title: curve.label,
          body: curve.detail,
          meta: curve.test,
        })),
      },
      {
        kind: 'definitions',
        heading: 'The chokepoint screen',
        blurb:
          'Being on a curve is not enough. Most of a supply chain is substitutable, and ' +
          'therefore uninteresting. A node earns coverage when it gates a curve.',
        items: CHOKEPOINT_TEST.map((factor) => ({ term: factor.question, detail: factor.detail })),
      },
      {
        kind: 'cards',
        heading: 'What counts as a node',
        blurb:
          'The unit of coverage is a chokepoint, not an asset class. This is how the universe ' +
          'reaches robotics, AI hardware and additive manufacturing without becoming ' +
          '“everything”: you arrive at them by tracing a chain you were already mapping.',
        columns: 3,
        cards: NODE_TYPES.map((node) => ({ title: node.label, body: node.detail })),
      },
      {
        kind: 'definitions',
        heading: 'Sequence',
        blurb:
          'Research first, because it costs nothing but attention and it is the sourcing work the desk needs anyway.',
        items: PHASES.map((phase) => ({
          term: `${phase.label}${phase.status === 'active' ? ' — active' : ''}`,
          detail: phase.detail,
        })),
      },
    ],
  };
}

// =====================================================================
// CHOKEPOINTS BEYOND MATERIALS
// =====================================================================

function chokepointsPage(): SitePage {
  const progress = chokepointProgress();

  // Cards, not a table. A table of names and country codes scans nicely and
  // says nothing — the claim IS the reason it gates, and a research page that
  // hides its reasoning behind a tidy grid has published a list, not research.
  const byCurve = MANDATE_CURVES.map((curve) => ({
    kind: 'cards' as const,
    heading: curve.label,
    blurb: curve.detail,
    columns: 2 as const,
    cards: CHOKEPOINTS.filter((point) => point.curve === curve.id).map((point) => ({
      title: point.name,
      body: point.why,
      meta: [
        NODE_TYPE_LABEL[point.type],
        point.jurisdictions.length ? point.jurisdictions.join(' ') : 'Not geographic',
        point.source ? 'Sourced' : 'Unverified lead',
      ].join('  ·  '),
    })),
  }));

  return {
    path: 'chokepoints',
    navLabel: 'Chokepoints',
    title: 'Chokepoints',
    intro: 'The constraints that are not materials — and often are the tighter ones.',
    sections: [
      {
        kind: 'prose',
        paragraphs: [
          'A material is only one kind of chokepoint. For the compute and power curves it ' +
            'is frequently not the binding one: a lithography tool with a single supplier, ' +
            'packaging capacity allocated years before it is used, a transformer order ' +
            'book, an interconnection queue, and process knowledge that does not transfer ' +
            'when a competitor buys the same equipment all gate the same three curves — ' +
            'and none of them appears on a periodic table.',
          'They enter coverage on exactly the tests a material does: does it move a curve, ' +
            'and does it genuinely gate it. The unit of coverage was never the substance. ' +
            'It is the constraint.',
          'Each row claims what the node is and why it gates, and nothing about capacity, ' +
            'market share or price — the same rule as the producer map, for the same ' +
            'reason. Rows read “unverified lead” until an analyst attaches a primary source.',
        ],
      },
      {
        kind: 'stats',
        heading: 'The universe so far',
        stats: [
          { label: 'Materials', value: String(MATERIALS.length) },
          { label: 'Non-material chokepoints', value: String(progress.total) },
          {
            label: 'Kinds of node',
            value: String(new Set(CHOKEPOINTS.map((point) => point.type)).size),
            note: 'Machines, processes, companies and people.',
          },
        ],
      },
      {
        kind: 'meter',
        heading: 'Verification',
        label: 'Chokepoint rows confirmed against a primary source',
        value: progress.sourced,
        of: progress.total,
        caption:
          'Newer than the producer map and further from finished. Published anyway, ' +
          'because a lead somebody can correct is worth more than a note nobody sees.',
      },
      ...byCurve,
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
    title: 'Thesis',
    intro: 'What we think follows from the map — stated so it can be scored, not admired.',
    sections: [
      {
        kind: 'prose',
        paragraphs: [
          'A research house is supposed to have a view and be judged on it. Each claim ' +
            'below carries a falsifier: the thing that, if observed, would show it to be ' +
            'wrong. A thesis without one is a slogan, and a slogan cannot be scored.',
          'This is a general view published to whoever reads it. It is not advice, it is ' +
            'not addressed to anyone in particular, and it takes no account of your ' +
            'circumstances — see Acting on it for what that does and does not permit.',
        ],
      },
      ...INVESTMENT_THESIS.map((claim) => ({
        kind: 'definitions' as const,
        heading: claim.claim,
        blurb: claim.detail,
        items: [{ term: 'What would prove this wrong', detail: claim.falsifier }],
      })),
    ],
  };
}

// =====================================================================
// PARTICIPANTS
// =====================================================================

function participantsPage(): SitePage {
  const progress = participantProgress();
  const binding = bindingParticipants();

  const layerTables: SiteSection[] = CHAIN_LAYERS.flatMap((layer) => {
    const rows = participantsInLayer(layer.id);
    if (rows.length === 0) {
      return [];
    }
    return [
      {
        kind: 'table' as const,
        heading: layer.name,
        anchor: layer.id,
        blurb: layer.detail,
        columns: ['Participant', 'Role in the chain', 'Where', 'Scarcity'],
        monoColumns: [2],
        statusColumn: 3,
        rows: rows.map((item) => [
          item.name,
          item.role,
          item.jurisdictions.join(' '),
          SCARCITY_LABEL[item.scarcity],
        ]),
      },
    ];
  });

  return {
    path: 'participants',
    navLabel: 'Participants',
    title: 'Participants',
    intro: 'Everyone in the chain from ore to buyer, graded by how hard they are to replace.',
    sections: [
      {
        kind: 'prose',
        paragraphs: [
          'A directory of everyone in a supply chain is a phone book. What makes this ' +
            'research is the last column: for each participant, whether it is a chokepoint, ' +
            'merely concentrated, or genuinely competitive.',
          'Grading participants “competitive” is not filler. It is the thing that makes ' +
            '“chokepoint” mean anything — a map on which every node is critical is a map ' +
            'nobody has actually read. Several well-known names in this list are here ' +
            'precisely because they are not constraints.',
          'On the demand side the grade reads the other way round: when a handful of firms ' +
            'account for most of the world’s orders, that concentration is a scarcity fact ' +
            'about the chain too, pointing upstream instead of down.',
        ],
      },
      {
        kind: 'stats',
        stats: [
          {
            label: 'Participants mapped',
            value: String(progress.total),
            note: `Across ${CHAIN_LAYERS.length} layers and ${progress.jurisdictions} jurisdictions.`,
          },
          {
            label: 'Graded a chokepoint',
            value: String(progress.chokepoints),
            note: 'One or very few qualified suppliers, and no substitute that arrives in time.',
          },
          {
            label: 'Graded competitive',
            value: String(progress.competitive),
            note: 'In the chain, and not a constraint on it. Saying so is the point.',
          },
        ],
      },
      {
        kind: 'definitions',
        heading: 'How the grades are assigned',
        blurb:
          'The mandate’s own screen — concentration, substitutability, lead time, demand ' +
          'inelasticity — applied one participant at a time.',
        items: (Object.keys(SCARCITY_DETAIL) as Array<keyof typeof SCARCITY_DETAIL>).map(
          (grade) => ({
            term: SCARCITY_LABEL[grade],
            detail: SCARCITY_DETAIL[grade],
          }),
        ),
      },
      {
        kind: 'cards',
        heading: 'Where the chain actually binds',
        blurb:
          `${binding.length} of ${progress.total} participants are graded a hard constraint. ` +
          'These are the ones worth knowing by name.',
        columns: 2,
        cards: binding.map((item) => ({
          title: item.name,
          body: item.why,
          meta: `${item.role}  ·  ${item.jurisdictions.join(' ')}`,
        })),
      },
      {
        kind: 'index',
        heading: 'The chain, layer by layer',
        blurb: 'Ordered upstream to downstream. The number is how many participants are mapped.',
        entries: CHAIN_LAYERS.map((layer) => ({
          label: layer.name,
          meta: String(participantsInLayer(layer.id).length),
          anchor: layer.id,
        })),
      },
      ...layerTables,
    ],
  };
}

// =====================================================================
// ACTING ON IT
// =====================================================================

function actingPage(): SitePage {
  const progress = readinessProgress();

  return {
    path: 'acting',
    navLabel: 'Acting on it',
    title: 'Acting on it',
    intro: 'What you can do with this research, and what we are not allowed to do for you.',
    sections: [
      {
        kind: 'definitions',
        heading: 'Read this first',
        blurb:
          'People read research and want to act on it — that is why it is published. But ' +
          'the line between publishing a view and advising a person is a legal one, and ' +
          'this firm sits firmly on the publishing side of it.',
        items: ACTING_LIMITS.map((limit, index) => ({
          term: `Limit ${index + 1}`,
          detail: limit,
        })),
      },
      ...ACTION_ROUTES.map((route) => ({
        kind: 'definitions' as const,
        heading: route.name,
        blurb: route.gives,
        items: [
          { term: 'Who provides it', detail: route.providedBy },
          { term: 'What it does not give you', detail: route.doesNotGive },
          { term: 'Worth asking', detail: route.ask.join(' · ') },
        ],
      })),
      {
        kind: 'prose',
        heading: 'What we can do if you get in touch',
        paragraphs: [
          'We can answer questions about the research: why a node is in the universe, ' +
            'what a grade designation means, who else makes something, what we have and ' +
            'have not verified. We are glad to be told a row is wrong, and that is the ' +
            'most useful message anyone sends us.',
          'We cannot tell you what to buy, how much, or when. Not because of caution but ' +
            'because doing so would be a licensed activity we are not licensed for, and ' +
            'a firm that quietly crosses that line has told you exactly how much its ' +
            'other statements are worth.',
        ],
      },
      {
        kind: 'meter',
        heading: 'Becoming the investor',
        label: 'Requirements met to manage money rather than only publish',
        value: progress.done,
        of: progress.total,
        caption:
          `${progress.done} done, ${progress.inProgress} in progress. Managing third-party ` +
          'money is licensed activity everywhere that matters, and the gap below is real ' +
          'rather than paperwork. It is published for the same reason the coverage meter ' +
          'is: a plan with statuses is a plan, and everything else is a feeling.',
      },
      {
        // Definitions, not a table. Three columns where one holds a paragraph
        // is a table that scrolls sideways on a phone and is read by nobody;
        // the status belongs next to the requirement, not in a column of its own.
        kind: 'definitions',
        heading: 'The ledger',
        items: READINESS.map((item) => ({
          term: `${item.requirement} — ${READINESS_STATUS_LABEL[item.status]}`,
          detail: item.detail,
        })),
      },
    ],
  };
}

// =====================================================================
// DISCLOSURE
// =====================================================================

function disclosurePage(): SitePage {
  return {
    path: 'disclosure',
    navLabel: 'Disclosure',
    title: 'Disclosure',
    intro: 'What this firm does, what it does not do, and what it holds.',
    sections: [
      {
        kind: 'definitions',
        heading: 'Today',
        blurb: DISCLOSURE.today,
        items: SCOPE.today.map((rule, index) => ({ term: `Position ${index + 1}`, detail: rule })),
      },
      {
        kind: 'prose',
        heading: 'On the desk that does not exist',
        paragraphs: [
          'Acting on this map rather than only publishing it would mean a regulated book: ' +
            'licensing, compliance, capital and counterparty onboarding, none of it quick ' +
            'and none of it started. It is an intention. Until it is real, no page here ' +
            'carries a price, a lot size or an invitation to deal, because a firm that ' +
            'advertises a capability it does not have has already told you how much its ' +
            'other claims are worth.',
          'The rules below are written now, in advance, for the reason a disclosure policy ' +
            'is only ever credible before it is needed. Written after the first position, ' +
            'every clause reads as a response to something.',
        ],
      },
      {
        kind: 'definitions',
        heading: 'The rules, when there is something to disclose',
        items: DISCLOSURE.rules.map((rule, index) => ({
          term: `Rule ${index + 1}`,
          detail: rule,
        })),
      },
      { kind: 'prose', heading: 'Why it is free', paragraphs: [DISCLOSURE.openByDefault] },
      { kind: 'prose', heading: 'Out of scope', paragraphs: [SCOPE.outOfScope] },
    ],
  };
}

// =====================================================================

export function substrataSitePages(): SitePage[] {
  // The board (/), the research page and each bottleneck's page are portal
  // routes under app/, drawn from the same config. These are the documents.
  return [
    mandatePage(),
    thesisPage(),
    chokepointsPage(),
    participantsPage(),
    actingPage(),
    disclosurePage(),
  ];
}
