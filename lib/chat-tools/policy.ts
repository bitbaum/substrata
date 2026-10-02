/**
 * Rules, for the assistant: the laws, controls, tariffs, subsidies and
 * standards that slow or speed building, with who publicly asked for each.
 *
 * Asked on /policy which rules make fabs harder to build and who asked for
 * them, the assistant said the corpus did not track this — the page it was on
 * listed twelve rules, nine that slow building (2026-10-02).
 */
import { INSTRUMENTS, JURISDICTION_LABEL, type Instrument } from '@/config/substrata-policy';
import { remember } from './ledger';
import { findBottleneck } from './resolve';
import { clip } from './shape';
import { str, type ChatTool } from './tool';

const EFFECT: Record<string, string> = {
  tightens: 'slows building (tightens the constraint)',
  loosens: 'speeds building (loosens the constraint)',
  mixed: 'both ways',
};

function ruleRow(i: Instrument) {
  return {
    rule: i.title,
    jurisdiction: JURISDICTION_LABEL[i.jurisdiction] ?? i.jurisdiction,
    body: i.body,
    kind: i.kind,
    status: `${i.status}${i.statusNote ? ` — ${clip(i.statusNote, 140)}` : ''}`,
    date: i.date,
    effect: EFFECT[i.effect] ?? i.effect,
    what_it_does: clip(i.summary, 220),
    bottlenecks: i.bottlenecks,
    asked_for_by: i.proponents.length
      ? i.proponents.map((p) => ({ who: p.name, asked: clip(p.asked, 160), source: p.source }))
      : 'Nobody named: no organisation has been found asking for it in its own words.',
    link: `[${clip(i.title, 80).replace(/[[\]]/g, '')}](${i.source})`,
    source_kind: i.primary ? 'primary source' : 'secondary source',
  };
}

export const POLICY_TOOLS: ChatTool[] = [
  {
    name: 'policy_rules',
    description:
      'Rules that slow or speed building — export controls, tariffs, subsidies, permitting, standards — with jurisdiction, status, effect, the bottlenecks they bear on, and who publicly asked for each (their own words, linked). Filter by bottleneck, jurisdiction (e.g. US, EU, CN) or effect (tightens / loosens).',
    parameters: {
      type: 'object',
      properties: {
        bottleneck: { type: 'string' },
        jurisdiction: { type: 'string', description: 'e.g. US, EU, CN, JP' },
        effect: { type: 'string', description: 'tightens or loosens' },
      },
    },
    label: (a) =>
      `Reading the rules${str(a.bottleneck) ? ` on ${str(a.bottleneck)}` : ''}${str(a.jurisdiction) ? ` in ${str(a.jurisdiction)}` : ''}`,
    async run(a, env) {
      const b = str(a.bottleneck) ? findBottleneck(str(a.bottleneck)) : undefined;
      const where = str(a.jurisdiction).toLowerCase();
      const effect = str(a.effect).toLowerCase();
      const rows = INSTRUMENTS.filter(
        (i) =>
          (!b || i.bottlenecks.includes(b.name)) &&
          (!where ||
            i.jurisdiction.toLowerCase() === where ||
            (JURISDICTION_LABEL[i.jurisdiction] ?? '').toLowerCase().includes(where)) &&
          (!effect || i.effect === effect),
      ).sort((x, y) => y.date.localeCompare(x.date));
      remember(env.ledger, {
        title: 'Policy: rules that slow or speed building',
        href: '/policy',
        kind: 'policy',
        evidence: 'each rule quotes its own source',
        primary: [],
      });
      return {
        page: '/policy',
        total: rows.length,
        rules: rows.slice(0, 8).map(ruleRow),
        ...(rows.length === 0 ? { note: 'No tracked rule matches those filters.' } : {}),
      };
    },
  },
];
