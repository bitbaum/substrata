/**
 * Where the reader is, and who they are, as the assistant sees it.
 *
 * "What about the other makers?" means nothing without the page it was asked
 * on, and "anything new on my rails?" means nothing without the rails. The
 * first assistant knew the page's NAME and nothing on it, and did not know the
 * reader at all. This assembles both, as plain data, so it is tested without a
 * model, a database or a request:
 *
 *   page    — the entity under the reader, resolved from the path, with its
 *             record pre-loaded so "tell me about this" needs no tool call;
 *   section — what kind of page it is when it is not an entity (the desk, the
 *             board, search), so "these" and "here" resolve;
 *   reader  — for a signed-in reader, the technologies and companies they
 *             follow and the bottlenecks those reach.
 */
import { resolveByPath } from './entities/registry';
import type { Entity } from './entities/types';
import { railsOf, type Follows } from './follows';
import { MARKET_PARTICIPANTS } from './participants';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { emptyLedger, type Ledger, type ToolEnv } from './chat-tools/ledger';
import { runTool } from './chat-tools/registry';

export interface ReaderContext {
  path?: string;
  /** The corpus record the page is about, if it is about one. */
  entity?: Pick<Entity, 'id' | 'kind' | 'key' | 'name' | 'href'>;
  /** Plain words for a page that is not a record. */
  section?: string;
  /** What the /chat page was opened about (`?topic=`). */
  topic?: string;
  reader?: {
    technologies: string[];
    companies: string[];
    /** Bottleneck names the follows reach. */
    rails: string[];
    /** True when they follow nothing yet, so the rails are the whole map. */
    everything: boolean;
  };
}

const SECTIONS: [RegExp, string][] = [
  [
    /^\/account(\/|$)/,
    "the reader's own research desk: a feed of accepted events and new sweep leads on their followed rails",
  ],
  [/^\/bottlenecks\/?$/, 'the bottleneck board: every tracked bottleneck, scored'],
  [
    /^\/exposure(\/|$)/,
    'the exposure screen: for every bottleneck, the companies holding it and where their shares trade (listed, listed only via a parent, or private), with tickers — the listed_exposure tool reads it',
  ],
  [/^\/markets\/?$/, 'the market directory of companies in the chains'],
  [/^\/search(\/|$)/, 'search results'],
  [/^\/events(\/|$)/, 'the accepted events feed'],
  [/^\/chat(\/|$)/, 'the full-page Ask view'],
  [/^\/?$/, 'the home page'],
];

export function sectionOf(path: string): string | undefined {
  const bare = path.split('?')[0].split('#')[0];
  return SECTIONS.find(([pattern]) => pattern.test(bare))?.[1];
}

export function readerContext(input: {
  path?: string;
  topic?: string;
  follows?: Follows | null;
}): ReaderContext {
  const context: ReaderContext = {};
  if (input.path) {
    context.path = input.path;
    const entity = resolveByPath(input.path);
    if (entity) {
      context.entity = {
        id: entity.id,
        kind: entity.kind,
        key: entity.key,
        name: entity.name,
        href: entity.href,
      };
    } else {
      context.section = sectionOf(input.path);
    }
  }
  if (input.topic?.trim()) context.topic = input.topic.trim().slice(0, 200);
  if (input.follows) {
    const f = input.follows;
    const everything = f.technologies.length === 0 && f.companies.length === 0;
    context.reader = {
      technologies: f.technologies.map((id) => TECHNOLOGIES.find((t) => t.id === id)?.name ?? id),
      companies: f.companies.map(
        (slug) => MARKET_PARTICIPANTS.find((p) => p.slug === slug)?.name ?? slug,
      ),
      rails: railsOf(f).map((b) => b.name),
      everything,
    };
  }
  return context;
}

/**
 * The record under the reader, fetched through the same tool the model would
 * call — so the pre-loaded context and a later lookup cannot disagree — and
 * noted in the ledger so it is listed among the records read.
 */
export async function preloadPage(
  context: ReaderContext,
  env: Omit<ToolEnv, 'ledger'> & { ledger?: Ledger },
): Promise<{ text: string; ledger: Ledger } | undefined> {
  const entity = context.entity;
  if (!entity) return undefined;
  const ledger = env.ledger ?? emptyLedger();
  const call =
    entity.kind === 'bottleneck'
      ? { name: 'get_bottleneck', args: { name: entity.key } }
      : entity.kind === 'company'
        ? { name: 'get_company', args: { name: entity.key } }
        : { name: 'get_record', args: { name: entity.name, kind: entity.kind } };
  const { result } = await runTool(call.name, call.args, { ...env, ledger });
  // Pre-loading is not something the reader asked for; keep it off the trail.
  ledger.trail.pop();
  return { text: result, ledger };
}

/** The part of the system prompt that says where the reader is. */
export function describeContext(context: ReaderContext): string {
  const lines: string[] = [];
  if (context.entity) {
    lines.push(
      `The reader is on the ${context.entity.kind} page for "${context.entity.name}" (${context.entity.href}). Resolve "this", "it", "they", "here" and "the other ones" against it first. On a page that is not a company, "this company" or "the maker" means an organisation the record joins to it.`,
    );
  } else if (context.section) {
    lines.push(`The reader is on ${context.section} (${context.path}).`);
  } else if (context.path) {
    lines.push(`The reader is on ${context.path}.`);
  }
  if (context.topic) lines.push(`They opened Ask about: ${context.topic}.`);
  if (context.reader) {
    const r = context.reader;
    if (r.everything) {
      lines.push(
        'The reader is signed in and follows nothing yet, so their rails are every bottleneck.',
      );
    } else {
      const follows = [
        r.technologies.length ? `technologies: ${r.technologies.join(', ')}` : '',
        r.companies.length ? `companies: ${r.companies.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('; ');
      lines.push(
        `The reader is signed in and follows ${follows}. Their rails (the bottlenecks those reach): ${r.rails.slice(0, 20).join(', ')}${r.rails.length > 20 ? `, and ${r.rails.length - 20} more` : ''}. "My rails", "what I follow" and "my desk" mean these; recent_leads and list_events default to them.`,
      );
    }
  } else {
    lines.push('The reader is not signed in.');
  }
  return lines.join('\n');
}
