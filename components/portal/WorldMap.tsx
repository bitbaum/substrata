'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ComposableMap,
  Geographies,
  Geography,
  Sphere,
  Graticule,
  ZoomableGroup,
} from 'react-simple-maps';
import type { ResourceId } from '@/config/substrata-resources';
import { resourcesFor } from '@/config/substrata-resources';

const GEO = '/geo/countries-110m.json';

export function WorldMap({ selected, resource }: { selected?: string; resource?: string }) {
  const router = useRouter();
  const [isoById, setIsoById] = useState<Record<string, string>>({});
  useEffect(() => {
    void fetch('/geo/iso-by-id.json')
      .then((r) => r.json())
      .then(setIsoById)
      .catch(() => undefined);
  }, []);

  const resourceId = resource as ResourceId | undefined;
  const fillFor = useMemo(() => {
    return (iso2: string | undefined, name: string) => {
      const iso = iso2 || isoById[name];
      if (!iso || iso === 'aq') return '#222';
      const endowment = resourcesFor(iso);
      const match = !resourceId || (endowment?.resources.includes(resourceId) ?? false);
      if (resourceId && !match) return '#1a1a1a';
      if (endowment?.resources.length) return '#c4a574';
      return '#3a3a3a';
    };
  }, [isoById, resourceId]);

  return (
    <div className="world-map-frame">
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155, center: [10, 8] }}
        width={800}
        height={420}
        className="world-map"
      >
        <ZoomableGroup center={[10, 8]} minZoom={1} maxZoom={8}>
          <Sphere id="sphere" fill="#0b0d0d" stroke="#2a2a2a" strokeWidth={0.4} />
          <Graticule stroke="#222" strokeWidth={0.3} />
          <Geographies geography={GEO}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name = String(geo.properties?.name ?? '');
                const iso = isoById[String(geo.id)] || isoById[name];
                if (iso === 'aq') return null;
                const active = selected && iso === selected;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    tabIndex={0}
                    fill={active ? '#e82127' : fillFor(iso, name)}
                    stroke="#0b0d0d"
                    strokeWidth={0.45}
                    className="world-geo"
                    onClick={() => {
                      if (!iso) return;
                      const params = new URLSearchParams({ view: 'world', country: iso });
                      if (resource) params.set('resource', resource);
                      router.push(`/atlas?${params.toString()}`);
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
