/**
 * "Peers on <resource>": the other leading producers of the resources a
 * country is most significant in, ranked by the same USGS/EIA column.
 *
 * This replaced "Similar geologies", which listed the first eight countries
 * sharing any one directory resource with the selected country — so Russia's
 * "similar geology" was Timor-Leste, because both have natural gas. A peer
 * here must rank in the table for that resource; sharing a word is not enough.
 */
import { countryResources, leadOf } from './country';
import { choropleth } from './choropleth';

export interface PeerGroup {
  resource: string;
  label: string;
  /** e.g. "Mine production, 2025". */
  basis: string;
  /** The selected country's own rank on this basis. */
  rank: number;
  peers: { iso2: string; name: string; rank: number; share: number | null; text: string }[];
  source: string;
}

/**
 * For the country's `resources` most significant resources where it ranks in
 * the top `within`, the `size` other highest-ranked producers.
 */
export function peersFor(
  iso2: string,
  {
    resources = 3,
    within = 10,
    size = 5,
    prefer,
  }: { resources?: number; within?: number; size?: number; prefer?: string } = {},
): PeerGroup[] {
  const id = iso2.toLowerCase();
  const measured = countryResources(id).measured;
  // The resource the reader picked leads, if the country ranks on it.
  const ordered = prefer
    ? [
        ...measured.filter((m) => m.resource === prefer),
        ...measured.filter((m) => m.resource !== prefer),
      ]
    : measured;
  return ordered
    .map((facts) => {
      const primary = leadOf(facts.production);
      const rank = primary?.current.rank;
      if (!primary || !rank || rank > within) return null;
      const map = choropleth(facts.resource, { series: primary.series });
      if (!map) return null;
      const peers = Object.values(map.values)
        .filter((v) => v.iso2 !== id && v.rank !== null)
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        .slice(0, size)
        .map((v) => ({
          iso2: v.iso2,
          name: v.name,
          rank: v.rank as number,
          share: v.share,
          text: v.text,
        }));
      return {
        resource: facts.resource,
        label: facts.label,
        basis: `${primary.label}, ${primary.year}`,
        rank,
        peers,
        source: facts.source.url,
      };
    })
    .filter((g): g is PeerGroup => g !== null && g.peers.length > 0)
    .slice(0, resources);
}
