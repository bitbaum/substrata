import { HORIZON_LABEL } from '@/config/substrata-assessment';
import { COMPANY_BOXES } from '@/lib/dossier/boxes/company';
import { companyExposure, type CompanyExposure } from '@/lib/company-exposure';
import { word } from '@/lib/company-exposure/refs';
import { ChokepointLink, Folded, Quoted, gradeWord } from './exposure-parts';
import { EmptyState } from './parts';

const SOURCES = COMPANY_BOXES.find((b) => b.id === 'suppliers')?.allowedSources;

/** What constrains it: chokepoints it rests on, hardest binding first. */
export function ConstrainedBy({ slug, name }: { slug: string; name: string }) {
  return <ConstrainedByView x={companyExposure({ slug, name })} />;
}

export function ConstrainedByView({ x }: { x: CompanyExposure }) {
  const gaps = x.unknown.filter((u) => u.side !== 'constrains');
  return (
    <div className="mk-business">
      {x.constrainedBy.map((d) => (
        <section key={d.chokepoint.slug} className="mk-group">
          <h3 className="mk-label">
            <ChokepointLink name={d.chokepoint.name} slug={d.chokepoint.slug} /> ·{' '}
            {d.chokepoint.binding} of 12 · {HORIZON_LABEL[d.chokepoint.horizon]}
          </h3>
          <p className="mk-basis">
            {d.relation === 'needs'
              ? d.via
                ? `Worked out: it holds ${d.via}, which needs this.`
                : d.grade === 'stated'
                  ? 'Its own filing says it needs this.'
                  : 'It buys from a holder of this; the filing does not name the chokepoint.'
              : 'Its market is the capacity of the holders of this.'}{' '}
            Grade: {gradeWord(d.grade)}.
          </p>
          <Quoted sources={d.evidence} />
          <p className="mk-basis">
            Held by {d.makers.filter((m) => !m.supplier).length} recorded{' '}
            {d.soleRecorded
              ? 'maker: the only one on record.'
              : 'makers; the ones named by the source come first.'}
          </p>
          <Folded
            rows={d.makers}
            suffix={(p) => ('supplier' in p && p.supplier ? '(supplies a part)' : '')}
          />
          <p className="mk-basis">
            {d.alternatives.length > 0
              ? `Alternatives written down: ${d.alternatives.map((a) => `${a.candidate} (${a.status}; blocked by ${a.blockedBy.join(', ')})`).join('; ')}.`
              : 'No alternative is written down for it, which is not the same as none existing.'}{' '}
            Judged on how hard to replace: {word(d.judged.substitution)}; on time to new capacity:{' '}
            {word(d.judged.leadTime)} ({d.judged.on}).
          </p>
          {d.behind.length > 0 && (
            <p className="mk-basis">
              It rests on:{' '}
              {d.behind.map((b, i) => (
                <span key={b.slug}>
                  {i > 0 && ', '}
                  <ChokepointLink name={b.name} slug={b.slug} /> ({b.binding})
                </span>
              ))}
              .
            </p>
          )}
        </section>
      ))}
      {x.named.filter((n) => n.direction === 'supplier').length > 0 && (
        <section className="mk-group">
          <h3 className="mk-label">Suppliers a source names, on no tracked chokepoint</h3>
          <Folded rows={x.named.filter((n) => n.direction === 'supplier')} />
        </section>
      )}
      {gaps.map((u) => (
        <EmptyState
          key={u.missing}
          name={x.name}
          missing={u.missing}
          sources={u.side === 'constrained-by' ? SOURCES : []}
          topic="suppliers"
        />
      ))}
    </div>
  );
}
