import { WORLD_PATHS } from '@/config/world-paths';
import { countryFacts, type CountryFact } from '@/lib/geo';

function weight(fact: CountryFact | undefined) {
  if (!fact?.hasRecord) return 0;
  return fact.instruments * 3 + fact.organisations + fact.events + fact.materials;
}

export function WorldMap({ selected }: { selected?: string }) {
  const facts = countryFacts();
  const weights = [...facts.values()].map(weight);
  const max = Math.max(1, ...weights);
  return (
    <svg
      viewBox="0 0 1000 500"
      role="img"
      aria-label="World map of recorded policy, organisations, events and materials"
      className="world-map"
    >
      <rect width="1000" height="500" className="world-map-ocean" />
      {WORLD_PATHS.map((country) => {
        const fact = country.iso2 ? facts.get(country.iso2) : undefined;
        const w = weight(fact);
        const active = selected && country.iso2 === selected;
        const href = country.iso2 ? `/atlas?view=world&country=${country.iso2}` : undefined;
        const node = (
          <path
            d={country.d}
            data-iso={country.iso2 || undefined}
            data-weight={w || undefined}
            className={[
              'world-map-country',
              w > 0 ? 'is-recorded' : '',
              active ? 'is-active' : '',
            ].join(' ')}
            style={w > 0 ? { opacity: 0.35 + (w / max) * 0.65 } : undefined}
          />
        );
        return href ? (
          <a key={country.name + country.iso2} href={href} aria-label={country.name}>
            {node}
          </a>
        ) : (
          <g key={country.name}>{node}</g>
        );
      })}
    </svg>
  );
}
