/**
 * Science, for the assistant: the technologies that could relieve a
 * bottleneck (with their readiness, 1–9) and the research pipeline — papers,
 * preprints and grants the site collects per bottleneck.
 *
 * Asked on /science "which technology is closest to relieving a bottleneck?",
 * the assistant had neither and named a 4/9 lab-stage crucible, while the page
 * it stood on listed amorphous-metal transformer cores at 9/9 (2026-10-02).
 */
import { SCIENCE, readinessLabel, type ScienceEntry } from '@/config/substrata-science';
import { PIPELINE_STAGE_LABEL } from '@/config/substrata-pipeline';
import { pipelineHref } from '../links';
import { remember } from './ledger';
import { findBottleneck } from './resolve';
import { clip } from './shape';
import { num, str, type ChatTool } from './tool';

function entryRow(e: ScienceEntry) {
  return {
    technology: e.name,
    readiness: `${e.readiness}/9 — ${readinessLabel(e.readiness)} (analyst judgement)`,
    what_it_is: clip(e.plain, 200),
    would_relieve: e.relieves.map((r) => ({
      bottleneck: r.bottleneck,
      page: `/bottlenecks/${findBottleneck(r.bottleneck)?.slug ?? ''}`,
      how: clip(r.mechanism, 160),
    })),
    why_this_readiness: clip(e.readinessWhy, 220),
    source: e.source ?? 'unsourced',
    next_milestone: e.nextMilestone,
    judged_on: e.judgedOn,
  };
}

export const SCIENCE_TOOLS: ChatTool[] = [
  {
    name: 'relief_technologies',
    description:
      'Technologies that could relieve bottlenecks, each with a readiness level 1–9 (9 = in production at scale; analyst judgement with a source), what it would relieve and how, and the next milestone. Give a bottleneck for those that would relieve it; omit it for all, most ready first.',
    parameters: {
      type: 'object',
      properties: { bottleneck: { type: 'string', description: 'Optional bottleneck name' } },
    },
    label: (a) =>
      `Reading the technologies that could relieve ${str(a.bottleneck) || 'the bottlenecks'}`,
    async run(a, env) {
      const b = str(a.bottleneck) ? findBottleneck(str(a.bottleneck)) : undefined;
      const rows = SCIENCE.filter(
        (e) => !b || e.relieves.some((r) => r.bottleneck === b.name),
      ).sort((x, y) => y.readiness - x.readiness);
      remember(env.ledger, {
        title: 'Science: what could relieve each bottleneck',
        href: '/science',
        kind: 'science',
        evidence: 'readiness is an analyst judgement, each citing a source',
        primary: [],
      });
      return {
        page: '/science',
        scale:
          '1 idea · 3 lab demo · 5 realistic setting · 7 pilot · 8 qualified, entering production · 9 in production at scale',
        technologies: rows.slice(0, 10).map(entryRow),
        ...(b && rows.length === 0
          ? { note: `No technology in the corpus is recorded as relieving ${b.name}.` }
          : {}),
      };
    },
  },
  {
    name: 'research_pipeline',
    description:
      'Recent papers, preprints, patents and grants the site has collected on a bottleneck (OpenAlex, arXiv, NSF, OpenAIRE, USAspending), each placed on the pipeline stage it shows (lab → pilot → scale). Machine-collected and unreviewed: say so.',
    parameters: {
      type: 'object',
      properties: {
        bottleneck: { type: 'string' },
        limit: { type: 'number', description: 'Items to list, default 8' },
      },
      required: ['bottleneck'],
    },
    label: (a) => `Reading new research on ${str(a.bottleneck) || '…'}`,
    available: (env) => Boolean(env.science),
    async run(a, env) {
      if (!env.science) return { error: 'The research pipeline is not reachable from here.' };
      const b = findBottleneck(str(a.bottleneck));
      if (!b) return { error: `No bottleneck called "${str(a.bottleneck)}".` };
      const items = await env.science(b.name, num(a.limit, 8, 1, 15));
      remember(env.ledger, {
        title: `Research pipeline: ${b.name}`,
        href: pipelineHref(b.name),
        kind: 'pipeline',
        evidence: 'machine-collected, unreviewed',
        primary: [],
      });
      return {
        bottleneck: b.name,
        page: pipelineHref(b.name),
        items: items.map((i) => ({
          title: clip(i.title, 160),
          kind: i.kind,
          stage: PIPELINE_STAGE_LABEL[i.stage] ?? i.stage,
          published: i.publishedOn,
          link: `[${clip(i.title, 80).replace(/[[\]]/g, '')}](${i.url})`,
        })),
        status:
          'Collected automatically from the open research databases; nobody has reviewed these.',
        ...(items.length === 0 ? { note: 'Nothing collected for this bottleneck yet.' } : {}),
      };
    },
  },
];
