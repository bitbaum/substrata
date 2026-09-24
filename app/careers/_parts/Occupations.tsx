import type { RoleFamilyId } from '@/config/careers-roles';
import { OCCUPATION_SOURCES, occupationsOf } from '@/lib/occupations';

/**
 * What the official occupational records say a role family does and needs:
 * O*NET (US) and ESCO (EU), each in its own words and linked to its record.
 * Nothing in these cards is Substrata's.
 */
export function Occupations({ family }: { family: RoleFamilyId }) {
  const records = occupationsOf(family);
  if (records.length === 0) return null;
  return (
    <div className="careers-grid">
      {records.map(({ onet, esco }) => (
        <article key={onet?.code ?? esco?.uri} className="careers-card">
          <p className="careers-kicker">
            {onet ? `O*NET ${onet.code}` : 'ESCO'}
            {esco?.iscoCode ? ` · ISCO ${esco.iscoCode}` : ''}
          </p>
          <h3>
            <a href={onet?.url ?? esco?.url} target="_blank" rel="noopener noreferrer">
              {onet?.title ?? esco?.title}
            </a>
          </h3>
          {onet && (
            <>
              <p>{onet.description}</p>
              {onet.jobZone && (
                <p>
                  <strong>{onet.jobZone.name}.</strong> {onet.jobZone.education}
                </p>
              )}
              {onet.tasks.length > 0 && (
                <>
                  <p className="careers-kicker">Core tasks</p>
                  <ul>
                    {onet.tasks.slice(0, 3).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="careers-kicker">Most important knowledge</p>
              <ul className="careers-terms">
                {onet.knowledge.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </>
          )}
          {esco && (
            <>
              <p className="careers-kicker">
                Essential skills in ESCO:{' '}
                <a href={esco.url} target="_blank" rel="noopener noreferrer">
                  {esco.title}
                </a>
              </p>
              <ul className="careers-terms">
                {esco.essentialSkills.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          <p className="careers-source">
            {onet && (
              <>
                <a href={OCCUPATION_SOURCES.onet.url} target="_blank" rel="noopener noreferrer">
                  {OCCUPATION_SOURCES.onet.name}
                </a>{' '}
                (US Department of Labor, CC BY 4.0){esco ? ' · ' : ''}
              </>
            )}
            {esco && (
              <a href={OCCUPATION_SOURCES.esco.url} target="_blank" rel="noopener noreferrer">
                {OCCUPATION_SOURCES.esco.name}
              </a>
            )}
          </p>
        </article>
      ))}
    </div>
  );
}
