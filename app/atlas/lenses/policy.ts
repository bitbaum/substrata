/**
 * The policy lens: the rules on record that touch it, which way each pushes,
 * the export restrictions on the raw material it is made from, and the
 * sanctions regimes over the countries it is made in.
 *
 * Restrictions (OECD inventory) and sanctions (EU, OFAC) are keyed by resource
 * and country, not by bottleneck; this lens reaches them the only honest way,
 * through the resource the bottleneck is made from and the countries its
 * makers work in, and says which link it followed.
 */
import {
  INSTRUMENT_EFFECT_LABEL,
  INSTRUMENT_KIND_LABEL,
  INSTRUMENT_STATUS_LABEL,
  JURISDICTION_LABEL,
  instrumentsFor,
} from '@/config/substrata-policy';
import type { Bottleneck } from '@/lib/bottlenecks';
import { policyHref } from '@/lib/links';
import { restrictionsOn } from '@/lib/resources/restrictions';
import { euRegimesFor, ofacProgramsFor } from '@/lib/resources/sanctions';
import { resourceOf } from '../chain-actions';
import { countryInProse, countryName } from '../chain-data';
import { listWords } from '../chain-story';
import { whereMade } from '../chain-route';
import { count, top, type Lens } from './types';

export function policyLens(chain: Bottleneck): Lens {
  const rules = instrumentsFor(chain.name);
  const resource = resourceOf(chain);
  const made = whereMade(chain);
  // The countries it is made in first: China's gallium licence matters more here than Kenya's ban.
  const restrictions = (resource ? restrictionsOn(resource.id) : []).sort(
    (a, b) => Number(!made.includes(a.iso2)) - Number(!made.includes(b.iso2)),
  );
  const restricting = [...new Set(restrictions.map((r) => r.iso2))];
  const sanctioned = made
    .map((iso) => ({ iso, eu: euRegimesFor(iso), us: ofacProgramsFor(iso) }))
    .filter((s) => s.eu.length + s.us.length > 0);
  const tightening = rules.filter((r) => r.effect === 'tightens');

  const means: string[] = [];
  means.push(
    rules.length > 0
      ? `${rules.length === 1 ? `One rule on record touches it, and it ${rules[0].effect === 'tightens' ? 'tightens' : rules[0].effect === 'loosens' ? 'loosens' : 'cuts both ways'}` : `${rules.length} rules on record touch it, ${tightening.length} of them tightening`}: ${listWords(top(rules, 3).map((r) => `${r.title} (${JURISDICTION_LABEL[r.jurisdiction] ?? r.jurisdiction}, ${r.date.slice(0, 4)})`))}.`
      : 'No rule or export control on record names it.',
  );
  if (resource) {
    means.push(
      restrictions.length > 0
        ? `It is made from ${resource.label.toLowerCase()}, which ${count(restricting.length, 'country restricts', 'countries restrict')} for export (${count(restrictions.length, 'measure', 'measures')} in the OECD inventory).`
        : `It is made from ${resource.label.toLowerCase()}; the OECD inventory lists no export restriction on it.`,
    );
  }
  if (made.length > 0) {
    means.push(
      sanctioned.length > 0
        ? `Sanctions regimes cover ${listWords(sanctioned.map((s) => countryInProse(s.iso)))}, where it is made.`
        : `No EU or US sanctions regime covers ${listWords(made.map(countryInProse))}, where it is made.`,
    );
  }

  return {
    id: 'policy',
    label: 'Policy',
    question: 'What governs it',
    means,
    figures: [
      {
        label: 'Rules on record',
        value: String(rules.length),
        note: `${tightening.length} tightening`,
      },
      ...(resource
        ? [
            {
              label: 'Restricting countries',
              value: String(restricting.length),
              note: resource.label,
            },
          ]
        : []),
      { label: 'Sanctioned maker countries', value: String(sanctioned.length) },
    ],
    groups: [
      ...(rules.length > 0
        ? [
            {
              title: 'Rules that touch it, newest first',
              items: rules.map((r) => ({
                title: r.title,
                meta: `${JURISDICTION_LABEL[r.jurisdiction] ?? r.jurisdiction} · ${r.date} · ${INSTRUMENT_KIND_LABEL[r.kind]} · ${INSTRUMENT_STATUS_LABEL[r.status]} · ${INSTRUMENT_EFFECT_LABEL[r.effect]}`,
                text: r.summary,
                href: policyHref(r.jurisdiction),
              })),
            },
          ]
        : []),
      ...(restrictions.length > 0
        ? [
            {
              title: `Export restrictions on ${resource!.label.toLowerCase()}`,
              items: top(restrictions, 6).map((r) => ({
                title: `${countryName(r.iso2)}: ${r.typeLabel}`,
                meta:
                  [
                    r.value && `${r.value}${r.valueUnit ? ` ${r.valueUnit}` : ''}`,
                    r.introduced && `since ${r.introduced}`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined,
                href: r.link ?? undefined,
                external: Boolean(r.link),
              })),
            },
          ]
        : []),
      ...(sanctioned.length > 0
        ? [
            {
              title: 'Sanctions over the countries it is made in',
              items: sanctioned.flatMap((s) => [
                ...s.eu.map((r) => ({
                  title: r.title,
                  meta: `EU · ${countryName(s.iso)}`,
                  href: r.url,
                  external: true,
                })),
                ...s.us.map((p) => ({
                  title: p.title,
                  meta: `US OFAC · ${countryName(s.iso)}`,
                  href: p.url,
                  external: true,
                })),
              ]),
            },
          ]
        : []),
    ],
    more: [
      { label: 'Policy, by jurisdiction', href: '/policy' },
      ...(resource
        ? [
            {
              label: `${resource.label} on the globe`,
              href: `/atlas?view=world&resource=${resource.id}`,
            },
          ]
        : []),
    ],
    weight: rules.length + restrictions.length + sanctioned.length,
  };
}
