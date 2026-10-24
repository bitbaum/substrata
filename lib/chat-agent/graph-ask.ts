/**
 * Questions the relation graph answers first: who owns X, X's shareholders,
 * what X holds or operates, X's partners, how X is connected to Y. Pure: the
 * calls it returns run through the same `runTool` as the model's.
 *
 * Read from the question's own shape, not its keywords, because the names
 * these questions carry are mostly firms the directory has never heard of
 * ("Inkai", "Kazatomprom") — they live only in the graph, and a name is only
 * planned when lib/graph/find.ts resolves it. A pronoun ("who owns them") is
 * never a name: that question is the facility rows' (producers_in).
 */
import { findGraphNode, type Prefer } from '../graph/find';
import { countryFrom } from '../chat-tools/graph-paths';
import { producerResource } from '../chat-tools/producers';
import type { ToolRequest } from './parse';

const PRONOUN = /^(them|it|they|these|those|this|that|its|their|him|her|which|what|who)$/i;

/** A kind of thing, not a name: "who owns the mines" asks about the rows producers_in returns. */
const GENERIC =
  /^((these|those|all|each|every|its|their|the)\s+)?(mines?|plants?|compan(y|ies)|facilit(y|ies)|ventures?|operators?|refiner(y|ies)|smelters?|projects?|producers?|miners?|firms?|deposits?|sites?)$/i;

/** A phrase as a name: no leading article, no trailing punctuation or "in <country>". */
function cleanName(raw: string | undefined): { name: string; country?: string } | undefined {
  if (!raw) return undefined;
  let name = raw
    .replace(/[?.!]+$/, '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim();
  let country: string | undefined;
  const where = name.match(/^(.+?)\s+in\s+(.+)$/i);
  if (where && countryFrom(where[2])) [, name, country] = where;
  name = name.replace(/['’]s?$/, '').trim();
  if (!name || PRONOUN.test(name) || GENERIC.test(name) || name.length > 80) return undefined;
  return { name, ...(country ? { country } : {}) };
}

interface Shape {
  re: RegExp;
  args: (m: RegExpMatchArray) => Record<string, unknown> | undefined;
}

const ownersOf = (raw: string | undefined) => {
  const n = cleanName(raw);
  return (
    n && {
      entity: n.name,
      direction: 'in',
      prefer: 'owned',
      ...(n.country && { country: n.country }),
    }
  );
};

const SHAPES: Shape[] = [
  {
    re: /\bwho(?:'s| is| are)?\s+(?:the\s+)?partners?\s+of\s+(.+)$|\b(?:who|what) are\s+(.+?)['’]s?\s+(?:joint[- ]venture\s+)?(?:partners|co-?owners)(?:\s+in\s+(.+?))?\s*[?.!]*$/i,
    args: (m) => {
      const n = cleanName(m[1] ?? m[2]);
      const country = m[3] ? cleanName(m[3])?.name : n?.country;
      return n && { entity: n.name, max_hops: 2, prefer: 'owner', ...(country && { country }) };
    },
  },
  {
    re: /\b(?:who|what) are\s+(.+?)['’]s?\s+(?:shareholders|owners|stakeholders|major holders)\b/i,
    args: (m) => ownersOf(m[1]),
  },
  {
    re: /\b(?:shareholders|owners|stakeholders|ownership) of\s+(.+)$/i,
    args: (m) => ownersOf(m[1]),
  },
  {
    re: /\bwho\s+(?:owns|controls|holds stakes? in|has (?:a )?stakes? in)\s+(.+)$/i,
    args: (m) => ownersOf(m[1]),
  },
  {
    re: /\b(?:which|what) (?:compan(?:y|ies)|ventures?|mines?|firms?) does\s+(.+?)\s+(?:hold|own|have|control)\b/i,
    args: (m) => {
      const n = cleanName(m[1]);
      return n && { entity: n.name, direction: 'out', type: 'owns', prefer: 'owner' };
    },
  },
  {
    re: /\bwhat (?:else )?does\s+(.+?)\s+(operate|run|own|control|hold)\b/i,
    args: (m) => {
      const n = cleanName(m[1]);
      const type = /operate|run/i.test(m[2]) ? 'operates' : 'owns';
      return n && { entity: n.name, direction: 'out', type, prefer: 'owner' };
    },
  },
];

const CONNECTED =
  /\bhow (?:is|are|does|do)\s+(.+?)\s+(?:connected|linked|related|tied|exposed)\s+(?:to|with)\s+(.+)$|\bwhat (?:connects|links)\s+(.+?)\s+(?:and|to|with)\s+(.+)$/i;

const call = (name: string, args: Record<string, unknown>): ToolRequest => ({
  name,
  args: JSON.stringify(args),
});

/** The graph lookups the question's shape asks for, first in the plan. */
export function graphCalls(question: string): ToolRequest[] {
  const q = question.trim();
  const connected = q.match(CONNECTED);
  if (connected) {
    const a = cleanName(connected[1] ?? connected[3]);
    const b = cleanName(connected[2] ?? connected[4]);
    if (a && b && findGraphNode(a.name, { prefer: 'owner' })) {
      const resource = producerResource(b.name);
      return [call('how_connected', { a: a.name, b: b.name, ...(resource && { resource }) })];
    }
  }
  for (const shape of SHAPES) {
    const m = q.match(shape.re);
    const args = m && shape.args(m);
    if (!args) continue;
    // "… in Chile" at the end of the question keeps one country.
    const where = q.match(/\bin\s+([A-Z][\w ]+?)\s*[?.!]*$/);
    if (!args.country && where && countryFrom(where[1])) args.country = where[1];
    const prefer = args.prefer as Prefer | undefined;
    if (findGraphNode(String(args.entity), { prefer })) return [call('related_to', args)];
  }
  return [];
}
