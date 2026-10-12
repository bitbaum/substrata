/**
 * The research lens: what could relieve it and how far along each way is,
 * whether anything could replace it, which of the site's own sentences about
 * it the numbers back, and whether the papers, grants and patents behind it
 * are being watched.
 *
 * Placements are the pipeline's own (lib/science-pipeline.ts judgementsFor),
 * so a technology reads the same stage here as on /science/pipeline.
 */
import { BLOCKER_LABEL, substitutesFor } from '@/config/substrata-substitutes';
import {
  NOT_SEARCHED_WHY,
  PIPELINE_STAGE_LABEL,
  SCIENCE_QUERIES,
} from '@/config/substrata-pipeline';
import { readinessLabel, scienceFor } from '@/config/substrata-science';
import type { Bottleneck } from '@/lib/bottlenecks';
import { claimsFor } from '@/lib/claims';
import { pipelineHref } from '@/lib/links';
import { judgementsFor } from '@/lib/science-pipeline';
import { listWords, lower } from '../chain-story';
import { count, type Lens } from './types';

export function researchLens(chain: Bottleneck): Lens {
  const ways = judgementsFor(chain.name).filter((w) => w.what === 'technology');
  const tech = scienceFor(chain.name);
  const subs = substitutesFor(chain.slug);
  const claims = claimsFor(chain.slug);
  const watched = Boolean(SCIENCE_QUERIES[chain.name]);
  const best = tech.reduce((m, s) => Math.max(m, s.readiness), 0);

  const means: string[] = [];
  if (tech.length > 0) {
    const lead = tech.find((s) => s.readiness === best)!;
    means.push(
      `${count(tech.length, 'technology is', 'technologies are')} on record as a way around it. The furthest along is ${lower(lead.name)}, at readiness ${best} of 9: ${readinessLabel(best).toLowerCase()}.`,
    );
  } else {
    means.push(
      'No technology is on record yet as a way around it — a gap in the research, and the opening for anyone working on one.',
    );
  }
  if (subs.length > 0) {
    const usable = subs.filter((s) => s.status === 'in use' || s.status.startsWith('qualified'));
    means.push(
      `${count(subs.length, 'substitute is', 'substitutes are')} on record; ${usable.length > 0 ? `for some uses there is already one: ${listWords(usable.map((s) => lower(s.candidate)))}` : 'none is qualified yet'}.`,
    );
  }
  means.push(
    watched
      ? 'New papers, grants and patents on it are collected every day and placed on the pipeline from lab to scale.'
      : `Papers on it are not collected yet${NOT_SEARCHED_WHY[chain.name] ? `: ${NOT_SEARCHED_WHY[chain.name]}` : '.'}`,
  );

  return {
    id: 'research',
    label: 'Research',
    question: 'What research could change it',
    means,
    figures: [
      { label: 'Ways around it', value: String(tech.length) },
      {
        label: 'Furthest along',
        value: tech.length ? `${best}/9` : '—',
        note: tech.length ? readinessLabel(best) : 'nothing on record',
      },
      { label: 'Substitutes', value: String(subs.length) },
    ],
    groups: [
      ...(ways.length > 0
        ? [
            {
              title: 'Ways around it, furthest along first',
              items: [...ways]
                .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))
                .map((w) => {
                  const entry = tech.find((s) => s.name === w.name);
                  const relief = entry?.relieves.find((r) => r.bottleneck === chain.name);
                  return {
                    title: w.name,
                    meta: `${PIPELINE_STAGE_LABEL[w.stage]}${w.readiness ? ` · readiness ${w.readiness}/9` : ''} · ${w.what}`,
                    text: [
                      relief?.mechanism,
                      entry?.nextMilestone ? `Next: ${entry.nextMilestone}` : '',
                    ]
                      .filter(Boolean)
                      .join(' '),
                    href: w.href ?? undefined,
                  };
                }),
            },
          ]
        : []),
      ...(subs.length > 0
        ? [
            {
              title: 'Could anything replace it',
              items: subs.map((s) => ({
                title: s.candidate,
                meta: `${s.status}${s.blockedBy[0] ? ` · held back by ${BLOCKER_LABEL[s.blockedBy[0]].toLowerCase()}` : ''}`,
                text: s.why,
              })),
            },
          ]
        : []),
      ...(claims.length > 0
        ? [
            {
              title: 'What the numbers back',
              items: claims.map((c) => ({
                title: `“${c.text}”`,
                meta: c.verdict === 'measured' ? 'measured' : 'softened to fit the numbers',
                text: c.how,
              })),
            },
          ]
        : []),
    ],
    more: [{ label: 'The relief pipeline', href: pipelineHref(chain.slug) }],
    weight: tech.length + subs.length,
  };
}
