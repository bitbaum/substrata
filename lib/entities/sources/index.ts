import type { Entity, EntityKind } from '../types';

import { source as article } from './article';
import { source as bottleneck } from './bottleneck';
import { source as capital } from './capital';
import { source as company } from './company';
import { source as country } from './country';
import { source as facility } from './facility';
import { source as learn } from './learn';
import { source as loop } from './loop';
import { source as policy } from './policy';
import { source as science } from './science';
import { source as talent } from './talent';

/**
 * One kind, one adapter, one file.
 *
 * The corpus is going to grow sideways — people in public roles, parties,
 * lobbies, think tanks, laboratories, more of the capital world — and each of
 * those is a new kind of thing rather than more of an existing one. Adding one
 * should be a file and a line here, not an edit to a module that every kind
 * shares and that grows without limit.
 *
 * Everything downstream then comes free: identity, search, the assistant's
 * retrieval, the relation web, a profile with discussion, and the path to the
 * loops it holds up.
 */
export interface EntitySource {
  kind: EntityKind;
  build(): Entity[];
}

export const ENTITY_SOURCES: EntitySource[] = [
  science,
  policy,
  talent,
  bottleneck,
  company,
  capital,
  loop,
  facility,
  learn,
  country,
  article,
];
