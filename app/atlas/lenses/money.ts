/**
 * The financing lens: whether money is what binds, and if it is, who could
 * actually write the cheque — named, with their own mandate, and with what
 * their kind of capital will not fund.
 *
 * "Money is not the constraint" is a finding worth stating plainly: it tells
 * an investor that capital alone will not buy relief, and points at what will.
 */
import {
  CAPITAL_KIND_LABEL,
  CONSTRAINT_LABEL,
  fundingFor,
  kindById,
  providersFor,
} from '@/config/substrata-capital';
import { SCIENCE_QUERIES } from '@/config/substrata-pipeline';
import { JURISDICTION_LABEL } from '@/config/substrata-policy';
import type { Bottleneck } from '@/lib/bottlenecks';
import { capitalHref, pipelineHref } from '@/lib/links';
import { listWords } from '../chain-story';
import { count, type Lens } from './types';

export function moneyLens(chain: Bottleneck): Lens {
  const funding = fundingFor(chain.name);
  const providers = providersFor(chain.name);
  const kinds = [...new Set(providers.map((p) => p.kind))];

  const means: string[] = [];
  if (funding) {
    means.push(`${CONSTRAINT_LABEL[funding.constraint]}. ${funding.why}`);
  } else {
    means.push('Whether money is the constraint has not been judged for it yet.');
  }
  if (providers.length > 0) {
    means.push(
      `${count(providers.length, 'funder on record has', 'funders on record have')} a mandate that could move it: ${listWords(kinds.map((k) => CAPITAL_KIND_LABEL[k].toLowerCase()))}.`,
    );
  } else if (funding && funding.constraint !== 'not-money') {
    means.push(
      'No funder on record has a mandate that reaches it — the gap a new fund would fill.',
    );
  }
  if (SCIENCE_QUERIES[chain.name]) {
    means.push(
      'Grants and public research money for it are collected with the papers, on the relief pipeline.',
    );
  }

  return {
    id: 'money',
    label: 'Money',
    question: 'What it means for financing',
    means,
    figures: [
      {
        label: 'Is money the constraint',
        value: funding ? CONSTRAINT_LABEL[funding.constraint] : 'Not judged',
        note: funding ? `judged ${funding.judgedOn}` : undefined,
      },
      { label: 'Funders who could move it', value: String(providers.length) },
    ],
    groups: [
      ...(providers.length > 0
        ? [
            {
              title: 'Who could fund relief',
              items: providers.map((p) => ({
                title: p.name,
                meta: `${CAPITAL_KIND_LABEL[p.kind]} · ${JURISDICTION_LABEL[p.jurisdiction] ?? p.jurisdiction}`,
                text: p.mandate,
                href: capitalHref(p.id),
              })),
            },
          ]
        : []),
      ...(kinds.length > 0
        ? [
            {
              title: 'What each kind of capital will and will not do',
              items: kinds.map((k) => {
                const kind = kindById(k);
                return {
                  title: kind.name,
                  meta: `${kind.chequeSize} · ${kind.horizon}`,
                  text: `Funds: ${kind.willFund} Will not: ${kind.willNotFund}`,
                };
              }),
            },
          ]
        : []),
    ],
    more: [
      { label: 'Capital, by kind and mandate', href: '/capital' },
      ...(SCIENCE_QUERIES[chain.name]
        ? [{ label: 'Grants on the pipeline', href: pipelineHref(chain.slug) }]
        : []),
    ],
    weight: (funding ? 1 : 0) + providers.length,
  };
}
