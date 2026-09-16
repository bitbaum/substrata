import { WORLD_PATHS } from '@/config/world-paths';
import { countriesWithResources, countryFacts } from '@/lib/geo';
import { resourcesFor, resourceLabel } from '@/config/substrata-resources';

export function WorldMap({ selected }: { selected?: string }) {
  const facts = countryFacts();
  const endowed = countriesWithResources();
  return (
    <svg
      viewBox="0 0 1000 420"
      role="img"
      aria-label="World map of resources and recorded research"
      className="world-map"
    >
      <rect width="1000" height="420" className="world-map-ocean" />
      {WORLD_PATHS.filter((c) => c.iso2 !== 'aq').map((country) => {
        const fact = country.iso2 ? facts.get(country.iso2) : undefined;
        const hasResource = country.iso2 ? endowed.has(country.iso2) : false;
        const hasCorpus = Boolean(fact?.hasRecord);
        const active = selected && country.iso2 === selected;
        const endowment = country.iso2 ? resourcesFor(country.iso2) : null;
        const label = [
          country.name,
          endowment?.resources.map(resourceLabel).join(', '),
          hasCorpus ? 'in the research corpus' : '',
        ]
          .filter(Boolean)
          .join(' — ');
        const href = country.iso2 ? `/atlas?view=world&country=${country.iso2}` : undefined;
        const node = (
          <path
            d={country.d}
            data-iso={country.iso2 || undefined}
            className={[
              'world-map-country',
              hasResource ? 'has-resource' : '',
              hasCorpus ? 'has-corpus' : '',
              active ? 'is-active' : '',
            ].join(' ')}
          />
        );
        return href ? (
          <a key={country.name + country.iso2} href={href} aria-label={label}>
            {node}
          </a>
        ) : (
          <g key={country.name}>{node}</g>
        );
      })}
    </svg>
  );
}
