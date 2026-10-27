/**
 * The one sentence a company page leads with, from the counts. It never
 * reads "holds 0 of N": a company that holds nothing outright is still
 * exposed to chokepoints, a constraint on others, or both — and when none of
 * that is recorded the sentence says it is not recorded, which is not the
 * same claim as none.
 */
import type { CompanyExposure } from './types';

export interface Headline {
  /** Plain text, ready to follow the company's role line. */
  text: string;
  /** What the sentence rests on, for the tiles. */
  kind: 'holds' | 'exposed' | 'unrecorded';
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function headline(x: CompanyExposure): Headline {
  const { holds, exposedTo, constrainsOrganisations, constrainsChokepoints, tracked } = x.counts;
  const parts: string[] = [];
  if (exposedTo > 0)
    parts.push(`exposed to ${exposedTo} of the ${tracked} bottlenecks tracked here`);
  const waits =
    constrainsOrganisations > 0
      ? plural(constrainsOrganisations, 'organisation')
      : constrainsChokepoints > 0
        ? plural(constrainsChokepoints, 'bottleneck')
        : '';
  if (holds > 0) parts.unshift(`holds ${plural(holds, 'bottleneck')} outright`);
  if (waits) parts.push(`a constraint on ${waits} on record`);
  if (parts.length === 0)
    return {
      kind: 'unrecorded',
      text: `No exposure is recorded for ${x.name} yet. That is a gap in the sources read, not a finding that it has none.`,
    };
  const text = parts.join('; ');
  return {
    kind: holds > 0 ? 'holds' : 'exposed',
    text: text.charAt(0).toUpperCase() + text.slice(1) + '.',
  };
}
