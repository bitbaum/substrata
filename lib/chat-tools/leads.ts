/** The sweep's unreviewed leads — never findings. */
import type { LeadHit } from '../sweep-queue';
import { findBottleneck } from './resolve';
import { clip } from './shape';
import { num, str, type ChatTool } from './tool';

export const LEAD_TOOLS: readonly ChatTool[] = [
  {
    name: 'recent_leads',
    description:
      "News pages the automated sweep found recently that NOBODY HAS REVIEWED yet. Use for 'what is new / what happened this week'. Without a bottleneck it covers the signed-in reader's followed rails, or everything. Every lead must be described as unreviewed.",
    parameters: {
      type: 'object',
      properties: {
        bottleneck: { type: 'string' },
        query: { type: 'string', description: 'Optional words to filter titles' },
        days: { type: 'number', description: 'Look-back window, default 30' },
      },
    },
    label: () => 'Checking the sweep for new leads',
    available: (env) => Boolean(env.leads),
    async run(args, env) {
      if (!env.leads) return { error: 'The lead queue is not reachable from here.' };
      const b = str(args.bottleneck) ? findBottleneck(str(args.bottleneck)) : undefined;
      const scope = b ? [b.name] : env.rails;
      let hits: LeadHit[];
      try {
        hits = await env.leads({
          bottlenecks: scope,
          query: str(args.query) || undefined,
          days: num(args.days, 30, 1, 365),
        });
      } catch {
        return { error: 'Could not read the lead queue just now.' };
      }
      env.ledger.leads.push(...hits.filter((h) => !env.ledger.leads.some((l) => l.url === h.url)));
      return {
        scope: b?.name ?? (env.rails ? "the reader's followed rails" : 'all bottlenecks'),
        leads: hits.map((h) => ({
          title: clip(h.title, 140),
          url: h.url,
          bottleneck: h.bottleneck,
          found: h.foundAt.slice(0, 10),
          published: h.published,
          excerpt: clip(h.excerpt, 240),
          effect_guess: h.effectGuess,
          status:
            h.verdict === 'accepted'
              ? 'Sweep lead a reviewer marked worth writing up — still not a published finding'
              : h.verdict === 'expired'
                ? 'EXPIRED sweep lead — nobody reviewed it in time; not a finding'
                : 'UNREVIEWED sweep lead — not a finding',
        })),
        note: hits.length ? undefined : 'The sweep has found nothing matching in that window.',
      };
    },
  },
];
