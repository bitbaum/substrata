/**
 * What Substrata itself has written: its notes (editorial) and its learning
 * guides, listed whole — there are few, and a listing costs one call where
 * searching for them by keyword cost four rounds (2026-10-02: "what has
 * Substrata published about its methods?" took 5 model calls).
 */
import { allLearn, allNotes, type Note } from '../notes';
import { remember } from './ledger';
import { clip } from './shape';
import { str, type ChatTool } from './tool';

const row = (n: Note, base: '/notes' | '/learn') => ({
  title: n.title,
  published: n.publishedAt,
  about: clip(n.summary, 220),
  tags: n.tags,
  link: `[${n.title.replace(/[[\]]/g, '')}](${base}/${n.slug})`,
});

export const WRITING_TOOLS: ChatTool[] = [
  {
    name: 'site_writing',
    description:
      "Everything Substrata itself has published: editorial notes (its methods, assumptions, what it does not know) and learning guides (how to read the site, how chains work). Use for questions about Substrata's own methods, articles or guides.",
    parameters: {
      type: 'object',
      properties: { only: { type: 'string', enum: ['notes', 'learn'], description: 'Optional' } },
    },
    label: () => 'Reading what Substrata has published',
    async run(a, env) {
      const only = str(a.only);
      const notes = only === 'learn' ? [] : allNotes().map((n) => row(n, '/notes'));
      const guides = only === 'notes' ? [] : allLearn().map((n) => row(n, '/learn'));
      remember(env.ledger, {
        title: 'Notes and guides',
        href: '/notes',
        kind: 'article',
        evidence: "Substrata's own writing",
        primary: [],
      });
      return {
        notes,
        guides,
        status: "Substrata's own writing (editorial), not evidence records.",
      };
    },
  },
];
