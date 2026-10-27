import Link from 'next/link';

import { businessGroups } from '@/lib/company-page/business';
import { resolveEntity } from '@/lib/entities/registry';
import { dependencyGroups } from '@/lib/profile/modules/dependencies';
import { RELATION_LABEL } from '@/lib/relations/types';
import { EmptyState } from './parts';

/** How many rows a group shows before the rest fold under "All n". */
const SHOWN = 6;

export function BusinessRows({
  rows,
}: {
  rows: ReturnType<typeof businessGroups>[number]['rows'];
}) {
  return (
    <ol className="mk-rows">
      {rows.map((r) => (
        <li key={r.id} className="mk-row">
          <span className="mk-row-name">
            {r.href ? <Link href={r.href}>{r.name}</Link> : r.name}
          </span>
          <span className="mk-row-figure">{r.amount ?? ''}</span>
          <span className="mk-row-detail">
            {r.relation} · {r.grade} · {r.asOf}
            {r.source && (
              <>
                {' · '}
                <a href={r.source.url} rel="noreferrer">
                  {r.source.label} ↗
                </a>
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Customers, suppliers and competitors always; stakes, sites and partners when the graph has them. */
export function Business({ id, name }: { id: string; name: string }) {
  const entity = resolveEntity(id);
  const deps = entity ? dependencyGroups(entity).map((g) => g.label) : [];
  const groups = businessGroups(id, name, undefined, {
    suppliers: deps.includes(RELATION_LABEL['depends-on'].forward),
    customers: deps.includes(RELATION_LABEL['sells-into'].forward),
  });
  return (
    <div className="mk-business">
      {groups.map((g) => (
        <section key={g.id} className="mk-group" aria-labelledby={`business-${g.id}`}>
          <h3 id={`business-${g.id}`} className="mk-label">
            {g.label}
            {g.rows.length > 0 ? ` · ${g.rows.length}` : ''}
          </h3>
          {g.empty ? (
            <>
              {g.seeAlso && (
                <a className="mk-see-also" href={g.seeAlso.href}>
                  {g.seeAlso.label} ↓
                </a>
              )}
              <EmptyState
                name={name}
                missing={g.empty.missing}
                sources={g.empty.sources}
                topic={g.id}
              />
            </>
          ) : (
            <>
              <BusinessRows rows={g.rows.slice(0, SHOWN)} />
              {g.rows.length > SHOWN && (
                <details className="mk-more">
                  <summary>All {g.rows.length}</summary>
                  <BusinessRows rows={g.rows.slice(SHOWN)} />
                </details>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
