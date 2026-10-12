/**
 * Every lens on a chain, in the order the tabs show them, and the one the
 * URL asked for (`?lens=`), falling back to the overview.
 */
import type { Bottleneck } from '@/lib/bottlenecks';
import type { ChainStory } from '../chain-story';
import { marketsLens } from './markets';
import { moneyLens } from './money';
import { overviewLens } from './overview';
import { peopleLens } from './people';
import { policyLens } from './policy';
import { researchLens } from './research';
import type { Lens, LensId } from './types';

export type { Lens, LensFigure, LensId, LensItem } from './types';

export const LENS_IDS: readonly LensId[] = [
  'overview',
  'markets',
  'research',
  'money',
  'people',
  'policy',
];

export function isLens(id: string | undefined): id is LensId {
  return LENS_IDS.includes(id as LensId);
}

export function chainLenses(chain: Bottleneck, story: ChainStory): Lens[] {
  return [
    overviewLens(chain, story),
    marketsLens(chain),
    researchLens(chain),
    moneyLens(chain),
    peopleLens(chain),
    policyLens(chain),
  ];
}
