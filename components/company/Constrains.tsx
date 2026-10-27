import { COMPANY_BOXES } from '@/lib/dossier/boxes/company';
import { companyExposure, type CompanyExposure } from '@/lib/company-exposure';
import { ChokepointLink, Folded } from './exposure-parts';
import { EmptyState } from './parts';

const SOURCES = COMPANY_BOXES.find((b) => b.id === 'customers')?.allowedSources;

/** What it constrains: who waits on what it holds, and who a source says buys from it. */
export function Constrains({ slug, name }: { slug: string; name: string }) {
  return <ConstrainsView x={companyExposure({ slug, name })} />;
}

export function ConstrainsView({ x }: { x: CompanyExposure }) {
  const customers = x.named.filter((n) => n.direction === 'customer');
  const gaps = x.unknown.filter((u) => u.side === 'constrains');
  return (
    <div className="mk-business">
      {x.constrains.map((c) => {
        const needs = c.waiting.filter((w) => w.relation === 'needs');
        const sells = c.waiting.filter((w) => w.relation === 'sells-into');
        return (
          <section key={c.chokepoint.slug} className="mk-group">
            <h3 className="mk-label">
              {c.supplier ? 'Supplies a part of ' : 'Holds '}
              <ChokepointLink name={c.chokepoint.name} slug={c.chokepoint.slug} /> ·{' '}
              {c.chokepoint.binding} of 12
            </h3>
            {needs.length > 0 && (
              <>
                <p className="mk-basis">Organisations whose own sources say they need it:</p>
                <Folded rows={needs} />
              </>
            )}
            {sells.length > 0 && (
              <>
                <p className="mk-basis">Organisations whose market is its holders’ capacity:</p>
                <Folded rows={sells} />
              </>
            )}
            {c.feeds.length > 0 && (
              <p className="mk-basis">
                Needed as an input by:{' '}
                {c.feeds.map((f, i) => (
                  <span key={f.slug}>
                    {i > 0 && ', '}
                    <ChokepointLink name={f.name} slug={f.slug} /> ({f.binding})
                  </span>
                ))}
                .
              </p>
            )}
            {c.reached.length > 0 && (
              <details className="mk-more">
                <summary>One step further: {c.reached.length} leads, not counted</summary>
                <Folded rows={c.reached} />
              </details>
            )}
          </section>
        );
      })}
      {customers.length > 0 && (
        <section className="mk-group">
          <h3 className="mk-label">Customers a source names</h3>
          <Folded rows={customers} />
        </section>
      )}
      {gaps.map((u) => (
        <EmptyState
          key={u.missing}
          name={x.name}
          missing={u.missing}
          sources={SOURCES}
          topic="customers"
        />
      ))}
    </div>
  );
}
