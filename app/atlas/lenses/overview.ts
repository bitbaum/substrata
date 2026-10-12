/**
 * The overview lens: what the thing is, why it binds, how hard and when, and
 * what has happened to it — the description a reader needs before any of the
 * other lenses make sense.
 *
 * It reads the fields the panel used to leave out: the research claim (`why`),
 * the grade that actually ships (`spec`), and the four tests behind the
 * severity score, each named and its score put in words.
 */
import { HORIZON_LABEL, SCORE_TESTS, SCORE_WORDS } from '@/config/substrata-assessment';
import type { Bottleneck } from '@/lib/bottlenecks';
import type { ChainStory } from '../chain-story';
import { count, top, type Lens } from './types';

const EFFECT: Record<string, string> = {
  tightens: 'tightens',
  loosens: 'loosens',
  mixed: 'mixed',
  neutral: 'no change',
};

export function overviewLens(chain: Bottleneck, story: ChainStory): Lens {
  const parts = story.parts.filter((p) => p.kicker !== 'How hard it binds');
  const means = [chain.why];
  if (chain.spec) means.push(`The grade that matters: ${chain.spec}`);
  return {
    id: 'overview',
    label: 'Overview',
    question: 'What it is, and why it binds',
    means,
    figures: [
      { label: 'Severity', value: `${chain.binding}/12`, note: 'four tests, 0–3 each' },
      { label: 'When it bites', value: HORIZON_LABEL[chain.horizon] },
      { label: 'Judged', value: chain.judgedOn, note: 'an analyst judgement' },
    ],
    groups: [
      {
        title: 'The chain in plain words',
        items: parts.map((p) => ({ title: p.kicker, text: p.text })),
      },
      {
        title: 'Why it scores what it scores',
        items: [
          ...SCORE_TESTS.map(([key, label]) => ({
            title: label,
            meta: `${chain.score[key]}/3 · ${SCORE_WORDS[chain.score[key]]}`,
          })),
          { title: 'In the analyst’s words', text: chain.rationale },
        ],
      },
      {
        title: chain.events.length
          ? `What has happened (${count(chain.events.length, 'event', 'events')} on file)`
          : 'What has happened',
        items: chain.events.length
          ? top(chain.events, 4).map((e) => ({
              title: e.headline,
              meta: `${e.date} · ${EFFECT[e.effect] ?? e.effect}`,
              href: e.source,
              external: true,
            }))
          : [{ title: 'No dated event on file yet', text: 'The daily sweep looks for them.' }],
      },
    ],
    more: [{ label: 'The full dossier', href: `/bottlenecks/${chain.slug}` }],
    weight: 1,
  };
}
