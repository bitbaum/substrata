'use client';

/**
 * One holding: its companies, what they hold, what they rest on, and — one
 * click open — the recorded rows and source sentences behind every route.
 */
import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { bottleneckHref, marketHref } from '@/lib/links';
import type { EdgeEvidence, RiskKind } from '@/lib/xray/holding';
import type { ResolvedHolding } from '@/lib/xray/portfolio';

export const RISK_LABEL: Record<RiskKind, string> = {
  'no-maker': 'No recorded maker',
  'sole-maker': 'Sole recorded maker',
  'private-maker': 'Private maker',
  'private-part': 'Private part supplier',
};

const regions = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

export function countryLabel(code: string): string {
  try {
    return regions?.of(code) ?? code;
  } catch {
    return code;
  }
}

function Evidence({ e }: { e: EdgeEvidence }) {
  return (
    <li className="xray-edge">
      <span className="xray-edge-head">
        {e.from} {e.kind === 'sells-into' ? 'sells into' : 'needs'} {e.on}
      </span>
      <q>{e.quote}</q>
      <span className="xray-sub">
        <a href={e.source} rel="noopener noreferrer" target="_blank">
          {e.primary ? 'Primary source' : 'Secondary source'}
        </a>
        {e.scope ? ` · ${e.scope}` : ''}
      </span>
    </li>
  );
}

export function XrayHolding({ h }: { h: ResolvedHolding }) {
  const makes = h.held.filter((r) => !r.supplier);
  const parts = h.held.filter((r) => r.supplier);
  const direct = h.depends.filter((d) => d.relation !== 'upstream');
  const upstream = h.depends.filter((d) => d.relation === 'upstream');
  const empty = h.held.length + h.depends.length === 0;

  return (
    <article className="xray-holding">
      <header className="xray-holding-head">
        <h3>
          <a
            href={h.security.source}
            rel="noopener noreferrer"
            target="_blank"
            className="xray-ticker"
          >
            {h.security.label}
          </a>{' '}
          {h.companies.map((c, i) => (
            <span key={c.slug}>
              {i > 0 ? ' + ' : ''}
              <Link href={marketHref(c.slug)}>{c.name}</Link>
            </span>
          ))}
        </h3>
        <span className="xray-sub">
          {h.security.parent ? `Listed via ${h.security.parent} · ` : ''}
          {h.weight === null ? (
            'no weight given'
          ) : (
            <>
              <Figure method="xray-weight">{`${Math.round(h.weight * 100)}%`}</Figure> of the
              portfolio
            </>
          )}
        </span>
      </header>

      {empty && (
        <p className="xray-note">
          The corpus records no bottleneck this company holds and no sourced dependency for it yet.
          That is a gap in the map, not a finding of no exposure.
        </p>
      )}
      {makes.length > 0 && (
        <p>
          <span className="xray-kicker">Holds</span>{' '}
          {makes.map((r) => (
            <span key={r.bottleneck} className="xray-rail">
              <Link href={bottleneckHref(r.slug)}>{r.bottleneck}</Link> ({r.role.toLowerCase()}
              {r.otherMakers === 0
                ? ', only recorded maker'
                : `, ${r.otherMakers} other recorded makers`}
              )
            </span>
          ))}
        </p>
      )}
      {parts.length > 0 && (
        <p>
          <span className="xray-kicker">Supplies a part to</span>{' '}
          {parts.map((r) => (
            <span key={r.bottleneck} className="xray-rail">
              <Link href={bottleneckHref(r.slug)}>{r.bottleneck}</Link> (not a second source of it)
            </span>
          ))}
        </p>
      )}
      {direct.length > 0 && (
        <p>
          <span className="xray-kicker">By its own filing</span>{' '}
          {direct.map((d) => (
            <span key={`${d.relation}-${d.bottleneck}`} className="xray-rail">
              {d.relation === 'sells-into' ? 'sells into ' : 'needs '}
              <Link href={bottleneckHref(d.slug)}>{d.bottleneck}</Link>
            </span>
          ))}
        </p>
      )}
      {upstream.length > 0 && (
        <p>
          <span className="xray-kicker">Upstream, through recorded inputs</span>{' '}
          {upstream.map((d) => (
            <span key={d.bottleneck} className="xray-rail">
              <Link href={bottleneckHref(d.slug)}>{d.bottleneck}</Link>
            </span>
          ))}
        </p>
      )}
      {h.depends.length > 0 && (
        <details className="xray-details">
          <summary>How each route is evidenced</summary>
          {h.depends.map((d) => (
            <div key={`${d.relation}-${d.bottleneck}`} className="xray-route">
              <p className="xray-route-head">{[d.start, ...d.path.map((e) => e.on)].join(' → ')}</p>
              <ul>
                {d.path.map((e, i) => (
                  <Evidence key={`${e.from}-${e.on}-${i}`} e={e} />
                ))}
              </ul>
            </div>
          ))}
        </details>
      )}
    </article>
  );
}
