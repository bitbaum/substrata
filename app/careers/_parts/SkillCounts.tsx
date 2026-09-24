import { SKILL_TERMS } from '@/config/careers-terms';
import { Figure } from '@/components/portal/Figure';

/**
 * Skills and credentials named across open postings, as counted by the
 * published list. A mention, not a requirement — the method says so.
 */
export function SkillCounts({ counts, total }: { counts: Map<string, number>; total: number }) {
  const kind = new Map(SKILL_TERMS.map((s) => [s.label, s.kind]));
  const rows = [...counts].filter(([label]) => kind.has(label)).slice(0, 16);
  if (rows.length === 0 || total === 0) return null;
  return (
    <div className="careers-table-wrap">
      <table className="careers-table">
        <thead>
          <tr>
            <th scope="col">Named in postings</th>
            <th scope="col">Kind</th>
            <th scope="col">Postings</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, n]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{kind.get(label) === 'credential' ? 'Credential' : 'Skill'}</td>
              <td>
                <Figure method="careers-skills">{String(n)}</Figure>
              </td>
              <td>
                <Figure method="careers-skills">{`${Math.round((n / total) * 100)}%`}</Figure>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
