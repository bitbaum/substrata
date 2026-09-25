/**
 * The world panel's empty state: coverage counts across the countries the map
 * draws (split from lib/geo.ts, which holds the per-country dossier).
 */
import { COUNTRIES } from '@/config/substrata-countries';
import { resourceLabel, resourcesFor } from '@/config/substrata-resources';
import { chapters } from '@/lib/resources/usgs';
import { countryFacts } from '@/lib/geo';

/**
 * Coverage across the countries the map draws. Pass the drawn ISO codes (the
 * atlas reads them from the map file) so the count is the map's, not the
 * directory's; without them it falls back to the country index.
 */
export function worldInsights(drawn?: readonly string[]) {
  const facts = countryFacts();
  const isos = [
    ...new Set(
      (drawn ?? COUNTRIES.map((c) => c.iso2))
        .map((i) => i.toLowerCase())
        .filter((i) => i && i !== 'aq'),
    ),
  ];
  const tabled = new Set(chapters().flatMap((c) => c.rows.map((r) => r.iso2 ?? '')));
  const withDirectory = isos.filter((iso) => (resourcesFor(iso)?.resources.length ?? 0) > 0);
  const withCorpus = isos.filter((iso) => facts.get(iso)?.hasRecord);
  const withFigures = isos.filter((iso) => tabled.has(iso));
  const tallies = new Map<string, number>();
  for (const iso of isos) {
    for (const r of resourcesFor(iso)?.resources ?? []) {
      tallies.set(r, (tallies.get(r) ?? 0) + 1);
    }
  }
  const resources = [...tallies.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, label: resourceLabel(id), count }));
  return {
    onMap: isos.length,
    withDirectory: withDirectory.length,
    withCorpus: withCorpus.length,
    withFigures: withFigures.length,
    gaps: isos.filter(
      (iso) =>
        !tabled.has(iso) && !facts.get(iso)?.hasRecord && !resourcesFor(iso)?.resources.length,
    ).length,
    resources,
  };
}
