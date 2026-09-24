/**
 * Scenarios drawn from the corpus's own record: each preset points at the
 * accepted event or policy instrument that makes it a live question, not a
 * thought experiment. The basis link is that record's own source.
 */
import { EVENTS } from '@/config/substrata-events';
import { INSTRUMENTS } from '@/config/substrata-policy';
import { parseTarget, type Scenario } from './target';

export interface Preset {
  id: string;
  title: string;
  at: string;
  only: string[];
  /** The corpus record that makes this realistic. */
  basis: { label: string; href: string; date: string | null };
}

function event(id: string) {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Preset basis: no accepted event "${id}"`);
  return { label: e.headline, href: e.source, date: e.date };
}

function instrument(id: string) {
  const i = INSTRUMENTS.find((x) => x.id === id);
  if (!i) throw new Error(`Preset basis: no policy instrument "${id}"`);
  return { label: i.title, href: i.source, date: i.date };
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'china-gallium',
    title: 'China halts gallium exports',
    at: 'country:CN',
    only: ['gallium-refined'],
    basis: event('2025-11-07-mofcom-suspends-october-package'),
  },
  {
    id: 'china-rare-earths',
    title: 'China halts rare-earth metal and magnet exports',
    at: 'country:CN',
    only: ['didymium-nd-pr-metal-magnet-feed', 'dysprosium-metal', 'rare-earth-magnet-sintering'],
    basis: event('2026-09-10-china-november-rare-earth-controls'),
  },
  {
    id: 'taiwan',
    title: 'Taiwan is cut off',
    at: 'country:TW',
    only: [],
    // No accepted event names a Taiwan disruption. The record that makes it a
    // question is the concentration itself, so the basis says exactly that.
    basis: {
      label: 'No accepted event; the record is the concentration on leading-edge foundry capacity',
      href: '/bottlenecks/leading-edge-foundry-capacity',
      date: null,
    },
  },
  {
    id: 'zeiss-offline',
    title: 'Carl Zeiss SMT goes offline',
    at: 'company:carl-zeiss-smt',
    only: [],
    basis: instrument('eu-dual-use-list-2026'),
  },
  {
    id: 'asml-offline',
    title: 'ASML cannot ship',
    at: 'company:asml',
    only: [],
    basis: event('2026-04-15-asml-60-euv-shipments'),
  },
  {
    id: 'ukraine-neon',
    title: 'Ukraine’s neon goes offline again',
    at: 'country:UA',
    only: ['neon-excimer-laser-grade'],
    basis: event('2022-11-10-tsmc-neon-supply-chain'),
  },
  {
    id: 'qatar-helium',
    title: 'Qatar’s helium stops',
    at: 'country:QA',
    only: ['liquid-helium-he-4'],
    basis: event('2026-03-18-iran-war-helium-shortage'),
  },
  {
    id: 'japan-photoresist',
    title: 'Japanese photoresist supply stops',
    at: 'country:JP',
    only: ['photoresist-formulation'],
    basis: event('2026-04-23-japan-photoresist-solvent-shortage'),
  },
  {
    id: 'quartz-corp',
    title: 'The Quartz Corp closes',
    at: 'company:the-quartz-corp',
    only: [],
    basis: event('2026-06-30-quartz-corp-spruce-pine-closure'),
  },
  {
    id: 'korea-hbm',
    title: 'Korea’s HBM lines stop',
    at: 'country:KR',
    only: ['high-bandwidth-memory-stacking-yield'],
    basis: instrument('us-bis-hbm-2024'),
  },
];

export function presetScenario(p: Preset): Scenario | null {
  const at = parseTarget(p.at);
  return at ? { at, only: [...p.only] } : null;
}
