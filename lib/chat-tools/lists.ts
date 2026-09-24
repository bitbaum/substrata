/** Ranked and dated lists: the bottlenecks by binding score, the accepted events. */
import { BOTTLENECKS } from '../bottlenecks';
import { eventsNewestFirst } from '@/config/substrata-events';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { findBottleneck, findCompany, norm } from './resolve';
import { bottleneckSummary, eventRow } from './shape';
import { num, str, type ChatTool } from './tool';

const TECH_IDS = TECHNOLOGIES.map((t) => t.id);

export const LIST_TOOLS: readonly ChatTool[] = [
  {
    name: 'list_bottlenecks',
    description:
      'The tracked bottlenecks ranked by the analyst binding score (0-12), optionally only those bearing on one technology front. Use for "what is most binding", overviews, comparisons.',
    parameters: {
      type: 'object',
      properties: {
        technology: { type: 'string', enum: TECH_IDS, description: 'Optional technology front' },
        limit: { type: 'number', description: 'Max rows, default 12' },
      },
    },
    label: () => 'Ranking the bottlenecks',
    async run(args) {
      const tech = TECH_IDS.includes(args.technology as (typeof TECH_IDS)[number])
        ? String(args.technology)
        : undefined;
      const rows = BOTTLENECKS.filter((b) => !tech || (b.technologies as string[]).includes(tech))
        .slice()
        .sort((a, b) => b.binding - a.binding)
        .slice(0, num(args.limit, 12, 1, 40));
      return { bottlenecks: rows.map(bottleneckSummary), note: 'Scores are analyst judgements.' };
    },
  },
  {
    name: 'list_events',
    description:
      'Accepted events (capacity, price, lead-time, policy, outage changes an analyst read and committed), newest first, optionally for one bottleneck or company and within N days.',
    parameters: {
      type: 'object',
      properties: {
        bottleneck: { type: 'string' },
        company: { type: 'string' },
        days: { type: 'number', description: 'Only events in the last N days' },
      },
    },
    label: (a) =>
      `Checking accepted events${a.bottleneck || a.company ? ` for ${str(a.bottleneck) || str(a.company)}` : ''}`,
    async run(args, env) {
      const b = str(args.bottleneck) ? findBottleneck(str(args.bottleneck)) : undefined;
      const p = str(args.company) ? findCompany(str(args.company)) : undefined;
      const days =
        typeof args.days === 'number' || typeof args.days === 'string'
          ? num(args.days, 3650, 1, 3650)
          : undefined;
      const cutoff = days
        ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
        : '';
      const scope =
        !b && !p && env.rails && !str(args.bottleneck) && !str(args.company)
          ? env.rails
          : undefined;
      const rows = eventsNewestFirst()
        .filter((e) => !b || e.bottlenecks.includes(b.name))
        .filter((e) => !p || e.participants.some((n) => norm(n) === norm(p.name)))
        .filter((e) => !scope || e.bottlenecks.some((n) => scope.includes(n)))
        .filter((e) => !cutoff || e.date >= cutoff)
        .slice(0, 10);
      return {
        scope: b?.name ?? p?.name ?? (scope ? "the reader's followed rails" : 'all bottlenecks'),
        events: rows.map(eventRow),
        note: rows.length ? undefined : 'No accepted event matches.',
      };
    },
  },
];
