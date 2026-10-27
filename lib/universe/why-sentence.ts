/**
 * "Why this company is here", in one paragraph built only from the evidence
 * rows that admit it: which funds hold it, which SEC industry code it files
 * under, how large the cited figure is against its floor, and which registry
 * identifiers it resolves to. No adjective, no opinion: every clause is a row
 * a reader can open from the Admissions list. A fund or index membership is
 * worded as interest in a theme, never as a part in a chain.
 */
import { THEMES, themeById } from '@/config/universe-themes';
import { usd } from './admit';
import type { Admission, UniverseEntry } from './types';

const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/** The fund's ticker, "ARKQ", from "Held by ARK Autonomous … ETF (ARKQ, ARK Invest): Robotics." */
const fundTicker = (a: Admission) =>
  /\(([A-Z0-9.]+),/.exec(a.detail)?.[1] ?? a.detail.replace(/:[^:]*$/, '');
const sourceName = (a: Admission) => a.detail.replace(/:[^:]*$/, '');

export function whySentence(entry: UniverseEntry): string {
  const by = entry.admittedBy;
  const themes = by.filter((a) => a.test === 'theme');
  const funds = [...new Set(themes.filter((a) => a.basis === 'fund').map(fundTicker))];
  const sic = [...new Set(themes.filter((a) => a.basis === 'sic').map(sourceName))];
  const classes = themes.some((a) => a.basis === 'industry-class');
  const chain = themes.find((a) => a.basis === 'chain-role');

  const parts: string[] = [];
  if (chain) parts.push(chain.detail.replace(/\.$/, ''));
  if (funds.length)
    parts.push(
      `${funds.length === 1 ? 'a thematic fund holds' : `${funds.length} thematic funds hold`} it (${funds.length > 4 ? `${funds.slice(0, 4).join(', ')} and ${funds.length - 4} more` : list(funds)})`,
    );
  if (sic.length) parts.push(sic[0].replace(/^Files/, 'it files'));
  if (classes) parts.push('Wikidata lists it under an industry class of the theme');
  const size = by
    .filter((a) => a.test === 'materiality' && a.usd)
    .sort((a, b) => b.usd! - a.usd!)[0];
  const sized = size
    ? `${usd(size.usd!)} ${size.detail.replace(/^US\$[\d.,]+ (million|billion|thousand)? ?/, '').replace(/ \(floor.*$/, '')} clears its floor`
    : null;

  const ids = by
    .filter((a) => a.test === 'identity')
    .map((a) => a.detail.replace(/^Exchange ticker/, 'ticker'));
  const theme = entry.themes.map((t) => themeById(t)?.label ?? t);
  const head = parts.length ? `${parts[0][0].toUpperCase()}${parts[0].slice(1)}` : '';
  const rest = parts.slice(1);
  const sentences = [
    head && `${head}${rest.length ? `; ${rest.join('; ')}` : ''}.`,
    theme.length &&
      (chain
        ? `Themes: ${list(theme)}.`
        : `That places it in ${list(theme)} (one of ${THEMES.length} tracked themes); it is interest in a theme, not a stated part of any supply chain.`),
    sized && `${sized[0].toUpperCase()}${sized.slice(1)}.`,
    ids.length && `It resolves to ${list(ids.slice(0, 4))}.`,
  ].filter(Boolean);
  return sentences.join(' ');
}
