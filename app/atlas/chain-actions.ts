/**
 * What a reader can DO with a chain, by who they are.
 *
 * The owner (2026-10-12): research that ends at a diagram is "senseless
 * research"; it has to be actionable, and the action depends on the reader —
 * an equity trader, a commodity trader, someone in the industry, someone
 * looking for work, someone learning. The five are the site's own audiences
 * (config/audiences.ts), so this is one more place they are served, not a
 * second list of them.
 *
 * Every row points at a page that already exists and is filtered to this
 * bottleneck, and says in one line what it will find there, from the data —
 * a ticker that is on file, a count of rules that are, a readiness that was
 * judged. A row with nothing behind it is not offered. Nothing here is advice:
 * the panel says so beside the list, in the site's own words.
 */
import { AUDIENCES, type AudienceId } from '@/config/audiences';
import { CONSTRAINT_LABEL, fundingFor } from '@/config/substrata-capital';
import { instrumentsFor } from '@/config/substrata-policy';
import { RESOURCE_KINDS, RESOURCE_TO_BOTTLENECKS } from '@/config/substrata-resources';
import { readinessLabel, scienceFor } from '@/config/substrata-science';
import type { Bottleneck } from '@/lib/bottlenecks';
import { lower } from './chain-story';
import { bottleneckHref, pipelineHref } from '@/lib/links';
import { listingForName, terminalTicker } from '@/lib/listings';
import { scenarioHref } from '@/lib/scenario/target';

export interface ChainAction {
  audience: AudienceId;
  /** The reader, as the site names them ("Equity investors"). */
  who: string;
  /** What they will find, from the data, in one sentence. */
  line: string;
  href: string;
  cta: string;
}

/** "ASML (ASML US)" for each maker of the thing that has a listing on file. */
function listedMakers(chain: Bottleneck): { name: string; ticker: string }[] {
  return chain.producers.flatMap((p) => {
    const listing = listingForName(p.name);
    if (!listing || (listing.status !== 'listed' && listing.status !== 'parent')) return [];
    const ref = listing.primary ?? listing.us;
    return ref ? [{ name: p.name, ticker: terminalTicker(ref) }] : [];
  });
}

/** The resource this bottleneck is made from, when the map can paint it. */
function resourceOf(chain: Bottleneck): { id: string; label: string } | null {
  for (const kind of RESOURCE_KINDS) {
    if (RESOURCE_TO_BOTTLENECKS[kind.id]?.includes(chain.name)) {
      return { id: kind.id, label: kind.label };
    }
  }
  return null;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function chainActions(chain: Bottleneck): ChainAction[] {
  const who = (id: AudienceId) => AUDIENCES.find((a) => a.id === id)?.label ?? id;
  const actions: ChainAction[] = [];
  const target = { kind: 'bottleneck' as const, slug: chain.slug, name: chain.name };

  // Equity investors: who is listed, and what a stop would hit downstream.
  const listed = listedMakers(chain);
  actions.push({
    audience: 'equities',
    who: who('equities'),
    line:
      listed.length > 0
        ? `Listed holders on file: ${listed.map((l) => `${l.name} (${l.ticker})`).join(', ')}. See which listed companies a stop would reach.`
        : 'No listed maker on file. See which listed companies a stop here would reach downstream.',
    href: scenarioHref({ at: target }),
    cta: 'What if it stops',
  });

  // Commodity traders: the raw material on the map, and the rules on the thing.
  const resource = resourceOf(chain);
  const rules = instrumentsFor(chain.name);
  if (resource || rules.length > 0) {
    actions.push({
      audience: 'commodities',
      who: who('commodities'),
      line: [
        resource
          ? `It is made from ${resource.label.toLowerCase()}; the map shows who mines it.`
          : '',
        rules.length > 0
          ? `${count(rules.length, 'rule or export control on file touches', 'rules and export controls on file touch')} it.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      href: resource
        ? `/atlas?${new URLSearchParams({ view: 'world', resource: resource.id }).toString()}`
        : bottleneckHref(chain.slug),
      cta: resource ? `Where ${resource.label.toLowerCase()} comes from` : 'Read the rules',
    });
  }

  // Industry teams: how long it binds, what could relieve it, whether money helps.
  const science = scienceFor(chain.name);
  const best = science.reduce((top, s) => Math.max(top, s.readiness), 0);
  const funding = fundingFor(chain.name);
  actions.push({
    audience: 'industry',
    who: who('industry'),
    line: [
      science.length > 0
        ? `${count(science.length, 'technology is', 'technologies are')} on record as a way around it; the most advanced is at readiness ${best}/9 (${readinessLabel(best).toLowerCase()}).`
        : 'No technology on record yet as a way around it.',
      funding ? `${CONSTRAINT_LABEL[funding.constraint]}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
    href: pipelineHref(chain.slug),
    cta: 'The relief pipeline',
  });

  // Job seekers: the roles filed under this bottleneck.
  actions.push({
    audience: 'jobs',
    who: who('jobs'),
    line: `Open roles at the companies that hold ${lower(chain.name)}, filed under it.`,
    href: `/careers?${new URLSearchParams({ bottleneck: chain.slug }).toString()}`,
    cta: 'Open roles',
  });

  // Learners: the full dossier, in order, with every source.
  const maker = chain.producers.find((p) => !p.supplier);
  actions.push({
    audience: 'learning',
    who: who('learning'),
    line: maker
      ? `Start with what it is and why one maker matters, then the evidence behind each line on this map.`
      : 'Start with what it is, then the evidence behind each line on this map.',
    href: bottleneckHref(chain.slug),
    cta: 'Read the dossier',
  });

  return actions;
}
