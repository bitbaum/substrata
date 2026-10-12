/**
 * The chain in plain words.
 *
 * The diagram shows the shape — needs, the thing, who makes it, what it
 * holds up — and the owner's reading of it (2026-10-12) was "a little bit
 * confusing": a map tells you where things are, not what they mean. This
 * module says what the chain is telling us, in sentences a person who has
 * never heard of the thing can follow, from the same rows the diagram draws.
 *
 * Nothing here is written by hand and nothing is guessed: every sentence is a
 * template over the bottleneck's own fields and its graph edges, so it cannot
 * say more than the sources do, and it changes the moment a row does.
 */
import type { Bottleneck } from '@/lib/bottlenecks';
import type { GraphEdge } from '@/lib/graph';
import { HORIZON_LABEL } from '@/config/substrata-assessment';
import type { ChainFlow, FlowNode } from './chain-data';

export interface StoryPart {
  /** The question this paragraph answers. */
  kicker: string;
  text: string;
}

export interface ChainStory {
  /** The whole chain in one sentence. */
  lede: string;
  parts: StoryPart[];
}

/** "A", "A and B", "A, B and C". */
export function listWords(items: readonly string[]): string {
  const words = items.filter((w) => w.trim().length > 0);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** Lower-case a label for mid-sentence use, keeping acronyms and proper nouns. */
export function lower(label: string): string {
  // Proper nouns and acronyms keep their case; "EUV projection optics" stays.
  return /^[A-Z][a-z]/.test(label) && !/^[A-Z]{2,}/.test(label)
    ? label.charAt(0).toLowerCase() + label.slice(1)
    : label;
}

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** The makers as the story names them: builders first, part suppliers after. */
function makerWords(flow: ChainFlow): { builders: string[]; suppliers: string[] } {
  const builders = flow.makers.filter((m) => !m.supplier).map((m) => m.label);
  const suppliers = flow.makers.filter((m) => m.supplier).map((m) => m.label);
  return { builders, suppliers };
}

/** Where the BUILDERS work — not every country on the chain. "ASML
 *  (Netherlands and Germany)" credited Zeiss's home to ASML. */
function placeWords(flow: ChainFlow): string {
  const builders = flow.makers.filter((m) => !m.supplier && m.note);
  const names =
    builders.length > 0
      ? builders.flatMap((m) => (m.note ?? '').split(' · '))
      : flow.places.map((p) => p.name);
  return listWords([...new Set(names)]);
}

function labels(nodes: readonly FlowNode[]): string[] {
  return nodes.map((n) => lower(n.label));
}

/** Where this thing stands in the loop, from its own assessment. */
function bindingWords(chain: Bottleneck): string {
  const when = HORIZON_LABEL[chain.horizon].toLowerCase();
  if (chain.binding >= 10)
    return `one of the hardest constraints on the map (${chain.binding}/12, ${when})`;
  if (chain.binding >= 7) return `a serious constraint (${chain.binding}/12, ${when})`;
  return `a constraint to watch rather than a wall (${chain.binding}/12, ${when})`;
}

export function chainStory(
  chain: Bottleneck,
  flow: ChainFlow,
  edges: readonly GraphEdge[],
): ChainStory {
  const { builders, suppliers } = makerWords(flow);
  const places = placeWords(flow);
  const needs = labels(flow.needs);
  const feeds = labels(flow.feeds);
  const fields = flow.technologies.map((t) => t.label);
  const relief = edges.filter((e) => e.rel === 'relieved by').map((e) => e.to.label);
  const rules = edges.filter((e) => e.rel === 'governed by').map((e) => e.to.label);

  // ── The lede: who, where, what it needs, what it holds up ─────────────
  const who =
    builders.length > 0
      ? `${listWords(builders)}${places ? ` (${places})` : ''} ${builders.length === 1 ? 'builds' : 'build'} ${lower(chain.name)}`
      : `Nobody is on record yet as the maker of ${lower(chain.name)}`;
  const inputs = needs.length > 0 ? `; it cannot be made without ${listWords(needs)}` : '';
  const outputs =
    feeds.length > 0
      ? `; stop it and ${listWords(feeds)} ${feeds.length === 1 ? 'stops' : 'stop'} with it`
      : fields.length > 0
        ? `; it is what ${listWords(fields)} ${fields.length === 1 ? 'runs' : 'run'} on`
        : '';
  const lede = sentence(`${who}${inputs}${outputs}`);

  // ── The parts, each answering one question ────────────────────────────
  const parts: StoryPart[] = [{ kicker: 'What it is', text: sentence(chain.plain) }];

  if (builders.length > 0 || suppliers.length > 0) {
    const built =
      builders.length === 1
        ? `${builders[0]} is the only maker on record${places ? `, working from ${places}` : ''}.`
        : builders.length > 1
          ? `${builders.length} makers are on record: ${listWords(builders)}${places ? ` — in ${places}` : ''}.`
          : `No maker is on record yet${places ? `; the work sits in ${places}` : ''}.`;
    const parts2 =
      suppliers.length > 0
        ? ` It cannot ship without parts from ${listWords(suppliers)} — a second chokepoint inside the first.`
        : '';
    parts.push({ kicker: 'Who makes it', text: `${built}${parts2}` });
  } else {
    parts.push({
      kicker: 'Who makes it',
      text: 'No maker is on record yet. That is a research gap, not a finding that nobody makes it.',
    });
  }

  if (needs.length > 0) {
    parts.push({
      kicker: 'What it needs',
      text: `It depends on ${listWords(needs)}. ${needs.length === 1 ? 'That input is' : 'Each of those is'} a bottleneck in its own right, so a stop upstream reaches here. Click one to walk up the chain.`,
    });
  }

  if (feeds.length > 0 || fields.length > 0) {
    const down =
      feeds.length > 0
        ? `If it stops, ${listWords(feeds)} ${feeds.length === 1 ? 'stops' : 'stop'} with it.`
        : 'Nothing downstream is on record yet.';
    const served =
      fields.length > 0
        ? ` That is where ${listWords(fields)} ${fields.length === 1 ? 'gets' : 'get'} its speed.`
        : '';
    parts.push({ kicker: 'What it holds up', text: `${down}${served}` });
  }

  parts.push({
    kicker: 'How hard it binds',
    text: `${capitalise(bindingWords(chain))}. ${sentence(chain.rationale)}`,
  });

  if (rules.length > 0 || relief.length > 0) {
    const governed = rules.length > 0 ? `It is governed by ${listWords(rules)}.` : '';
    const relieved =
      relief.length > 0
        ? ` The one way around it on record is ${listWords(relief)} — a readiness judgement, not a product.`
        : '';
    parts.push({ kicker: 'Rules and ways around', text: `${governed}${relieved}`.trim() });
  }

  return { lede, parts };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
