import Link from 'next/link';
import { countryName } from '@/lib/careers-geo';
import { KIND_LABEL, type LearningPath } from '@/lib/learning-paths';

function where(country: string): string {
  if (country === 'online') return 'Online';
  if (country === 'EU') return 'EU';
  return countryName(country.toUpperCase());
}

/** Learning paths, each linked to the official page it was checked on. */
export function Paths({ paths }: { paths: LearningPath[] }) {
  if (paths.length === 0) {
    return (
      <p className="desk-empty">
        No public programme has been checked for this yet. If you know one, tell us on the{' '}
        <Link href="/join">join page</Link>.
      </p>
    );
  }
  return (
    <div className="careers-grid">
      {paths.map((p) => (
        <article key={p.id} className="careers-card">
          <p className="careers-kicker">
            {KIND_LABEL[p.kind]} · {where(p.country)}
            {p.careerChangers === true ? ' · open to career changers' : ''}
          </p>
          <h3>
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              {p.name} ↗
            </a>
          </h3>
          <p>{p.provider}</p>
          {p.format && <p>{p.format}</p>}
          <p>{p.note}</p>
          <p className="careers-source">
            Official page checked {p.checkedOn}. Listed, not reviewed or endorsed.
          </p>
        </article>
      ))}
    </div>
  );
}
