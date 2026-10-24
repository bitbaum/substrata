import { defineModule, type AnyProfileModule } from '../define';
import type { ProfileModule } from '../types';
import type { Entity } from '../../entities/types';
import { related, discussion } from './shared';
import { timeline } from './timeline';
import { chokepoints } from './company';
import { companyEvents } from './company-happened';
import { relief, sameLayer, sources } from './company-context';
import { ownership } from './ownership';
import { numbers } from './numbers';
import { relieves, readiness, milestone } from './science';
import { around } from './science-around';
import { mandate, canMove, source } from './capital';
import { why, severity, producers } from './bottleneck';
import { rules, removes, calls, funding } from './bottleneck-levers';
import { role } from './role';
import { turn, gates } from './loop';
import { production, substitutes } from './quantities';
import { places, facilitySupply } from './facility';
import { dependencies } from './dependencies';
import { produces, companies } from './country';
import { rules as countryRules, access, countryEvents } from './country-rules';
import { dossier } from './dossier';

/**
 * The registry. A new section is one definition plus one entry here.
 *
 * `importance` is a shared scale across every kind, not a per-kind ordering, so
 * profiles read the same way whatever you are looking at: what it is, how it is
 * judged, who is involved, what governs it, what would change it, what has
 * happened, what it connects to, and then the discussion.
 *
 *   10  what this thing is
 *   20  how it is judged or graded
 *   30  who or what is involved
 *   40+ what governs it, what would change it, what was predicted, who funds it
 *   80  what has happened
 *   84+ what it connects to
 *   86  what the corpus knows and lacks (the dossier)
 *   89  the sources a company page rests on, after what they support
 *   90  discussion, last, because it responds to everything above
 *
 * A company reads: what it holds (10), who owns it (20), the numbers it
 * reports (30), what has happened (40), leads (45, from the page), what
 * could loosen its grip (50), ways to take part (55) and hiring (58, both
 * from the page), others at its step (60), what it connects to (88), sources
 * (89). The page's own sections take their importance from
 * `COMPANY_SECTION_IMPORTANCE` in lib/company-sections.ts.
 */
export const PROFILE_MODULES: AnyProfileModule[] = [
  // Bottleneck
  why,
  severity,
  producers,
  production,
  places,
  facilitySupply,
  rules,
  removes,
  substitutes,
  calls,
  funding,
  // Company
  chokepoints,
  ownership,
  numbers,
  companyEvents,
  relief,
  sameLayer,
  sources,
  // Science
  relieves,
  readiness,
  milestone,
  around,
  // Capital
  mandate,
  canMove,
  source,
  // Loop
  turn,
  gates,
  // Country
  produces,
  companies,
  countryRules,
  access,
  countryEvents,
  // Every kind that has them
  dependencies,
  dossier,
  timeline,
  role,
  related,
  discussion,
].map((module) => defineModule(module as ProfileModule<unknown>));

/**
 * The modules that apply to an entity, in render order.
 *
 * Selection lives here rather than in the component so the page, a future
 * compare view and the tests all ask the same question.
 */
export function modulesFor(entity: Entity, from?: number): AnyProfileModule[] {
  return PROFILE_MODULES.filter(
    (module) => module.applies(entity.kind) && (from === undefined || module.importance >= from),
  ).sort((a, b) => a.importance - b.importance);
}
