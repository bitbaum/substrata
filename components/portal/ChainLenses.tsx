/**
 * A chain read six ways — overview, markets, research, money, people, policy —
 * as tabs under the chain's title. Each tab is a link (`?lens=`), so a lens
 * can be shared and the panel needs no script to switch; every lens is laid
 * out alike: the question, what it means, the figures, the records, and where
 * all of it lives. The reader the lens serves most is named above that last
 * step, so an equity investor or a job seeker finds their door by name.
 *
 * The lenses themselves are built from records in app/atlas/lenses/.
 */
import Link from 'next/link';

import type { Lens, LensId } from '@/app/atlas/lenses';
import type { ChainAction } from '@/app/atlas/chain-actions';
import { TAKE_PART_NOT_ADVICE } from '@/config/substrata-take-part';

/** Which reader a lens serves first: the site's own audiences. */
const SERVES: Partial<Record<LensId, ChainAction['audience']>> = {
  overview: 'learning',
  markets: 'equities',
  research: 'industry',
  people: 'jobs',
  policy: 'commodities',
};

export function LensTabs({
  lenses,
  current,
  hrefFor,
}: {
  lenses: Lens[];
  current: LensId;
  hrefFor: (id: LensId) => string;
}) {
  return (
    <nav className="lens-tabs" aria-label="Read this chain by">
      <ul>
        {lenses.map((l) => (
          <li key={l.id}>
            <Link
              href={hrefFor(l.id)}
              scroll={false}
              aria-current={l.id === current ? 'page' : undefined}
              data-thin={l.weight === 0 || undefined}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function LensBody({ lens, actions }: { lens: Lens; actions: ChainAction[] }) {
  const audience = SERVES[lens.id];
  const serves = audience ? actions.find((a) => a.audience === audience) : undefined;
  return (
    <section className="lens" aria-labelledby={`lens-${lens.id}`}>
      <h3 id={`lens-${lens.id}`} className="lens-question">
        {lens.question}
      </h3>
      <div className="lens-means">
        {lens.means.map((m) => (
          <p key={m}>{m}</p>
        ))}
      </div>
      {lens.figures.length > 0 && (
        <dl className="lens-figures">
          {lens.figures.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
              {f.note && <dd className="lens-figure-note">{f.note}</dd>}
            </div>
          ))}
        </dl>
      )}
      {lens.groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.title} className="lens-group">
            <h4>{g.title}</h4>
            <ul>
              {g.items.map((item) => {
                const body = (
                  <>
                    <span className="lens-item-title">{item.title}</span>
                    {item.meta && <span className="lens-item-meta">{item.meta}</span>}
                    {item.text && <span className="lens-item-text">{item.text}</span>}
                  </>
                );
                return (
                  <li key={item.title + (item.meta ?? '')}>
                    {item.href ? (
                      item.external ? (
                        <a
                          className="lens-item"
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {body}
                        </a>
                      ) : (
                        <Link className="lens-item" href={item.href}>
                          {body}
                        </Link>
                      )
                    ) : (
                      <div className="lens-item">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      <div className="lens-more">
        {serves && <p className="lens-serves">Most useful to {serves.who.toLowerCase()}</p>}
        <ul>
          {lens.more.map((m) => (
            <li key={m.href}>
              <Link href={m.href}>
                {m.label} <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
        {lens.id === 'markets' && (
          <p className="atlas-fine">
            <strong>{TAKE_PART_NOT_ADVICE.lead}</strong> These are records to read, not trades to
            make.
          </p>
        )}
      </div>
    </section>
  );
}
