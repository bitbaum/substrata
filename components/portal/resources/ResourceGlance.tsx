/**
 * The resource in four figures, each a link to the section that holds the
 * rows behind it. Every number is read from the same profile the sections
 * read, so a tile cannot say one thing and the table another.
 */
import { StatTiles } from '@bitbaum/chartkit/react';
import { methodHref } from '@/lib/methods';
import { formatShare, ordinal } from '@/lib/resources/format';
import type { ResourceProfile } from '@/lib/resources/profile';
import { countryHref } from '@/lib/world/pages';

export function ResourceGlance({ profile }: { profile: ResourceProfile }) {
  const g = profile.glance;
  return (
    <StatTiles
      caption={`${profile.label} at a glance`}
      tiles={[
        {
          label: `World ${g.world.seriesLabel.toLowerCase()}`,
          value: g.world.text,
          note: `${g.world.unitLabel}, ${g.world.year}`,
          href: '#production-by-country',
        },
        {
          label: 'Top producer',
          value: g.top?.name ?? '—',
          note: g.top
            ? g.top.share !== null
              ? `${formatShare(g.top.share)} of the world, ${ordinal(1)}`
              : `${g.top.text} ${g.world.unitLabel}`
            : 'no country listed individually',
          href: g.top ? countryHref(g.top.iso2, profile.resource) : undefined,
        },
        {
          label: 'Concentration',
          value: g.hhi !== null ? g.hhi.toFixed(2) : '—',
          note:
            g.hhi !== null
              ? `Herfindahl index of production; a single supplier would score one${g.reservesHhi !== null ? `; reserves ${g.reservesHhi.toFixed(2)}` : ''}`
              : 'no share can be computed',
          href: methodHref('hhi'),
        },
        {
          label: 'Exporters restricting it',
          value: g.restricting,
          note:
            g.measures > 0
              ? `${g.measures} measure${g.measures === 1 ? '' : 's'} in the OECD inventory`
              : 'none recorded in the OECD inventory',
          href: '#export-restrictions',
        },
      ]}
    />
  );
}
