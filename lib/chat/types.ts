/** The shapes a chat answer is exchanged in: a transcript turn and a cited source. */
import type { ResearchDocument } from '../research-index';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type ChatSource = {
  number: number;
  id: string;
  title: string;
  href: string;
  evidence: string;
  primary: string[];
  kind: ResearchDocument['kind'];
};
