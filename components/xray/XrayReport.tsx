'use client';

/**
 * The X-ray's answer: what the portfolio rests on, rail by rail and country
 * by country, then each holding with the evidence for every route, then the
 * news on those rails and what could not be read.
 */
import Link from 'next/link';
import { useState } from 'react';

import { HORIZON_LABEL } from '@/config/substrata-assessment';
import { BINDING_MAX } from '@/components/desk/BindingScore';
import { Figure } from '@/components/portal/Figure';
import { bottleneckHref } from '@/lib/links';
import { methodHref } from '@/lib/methods';
import { xrayCsv } from '@/lib/xray/csv';
import type { PortfolioXray, PortfolioRail, RailRelation } from '@/lib/xray/portfolio';
import { XrayHolding, RISK_LABEL, countryLabel } from './XrayHolding';

export interface Filing {
  title: string;
  url: string;
  at: string;
  form: string | null;
  bottlenecks: string[];
}

const RELATION_LABEL: Record<RailRelation, string> = {
  holds: 'holds',
  part: 'supplies a part',
  needs: 'needs (filing)',
  'sells-into': 'sells into (filing)',
  upstream: 'upstream',
};

export const pct = (share: number) => `${Math.round(share * 100)}%`;

function Score({ r }: { r: PortfolioRail }) {
  const s = r.score;
  const parts = `concentration ${s.concentration} + substitution ${s.substitution} + lead time ${s.leadTime} + inelasticity ${s.inelasticity}`;
  return (
    <Link href={`${bottleneckHref(r.slug)}#assessment`} className="xray-score" title={parts}>
      {r.binding}
      <span>/{BINDING_MAX}</span>
      <small>
        {s.concentration}+{s.substitution}+{s.leadTime}+{s.inelasticity}
      </small>
    </Link>
  );
}

function download(data: PortfolioXray) {
  const blob = new Blob([xrayCsv(data)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `substrata-xray-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function UseMyRails({ slugs }: { slugs: string[] }) {
  const [state, setState] = useState<string | null>(null);
  async function add() {
    setState('Adding…');
    const res = await fetch('/api/xray/rails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs }),
    });
    const body = await res.json().catch(() => ({}));
    setState(
      res.ok
        ? `Added. Your desk now follows ${body.following} bottlenecks.`
        : (body.error ?? 'Could not add.'),
    );
  }
  return (
    <>
      <button type="button" className="research-button-ghost" onClick={add}>
        Put these {slugs.length} bottlenecks on my desk
      </button>
      {state && <span className="xray-note">{state}</span>}
    </>
  );
}

export function XrayReport({
  data,
  signedIn,
}: {
  data: PortfolioXray & { filings: Filing[] | null; filingDays: number };
  signedIn: boolean;
}) {
  const { holdings, rails, countries, risks, events, unresolved } = data;
  const single = countries.filter((c) => c.allRails.length > 0);
  return (
    <section className="xray-report" aria-label="X-ray result">
      <div className="xray-summary">
        <p>
          <strong>{holdings.length}</strong> holding{holdings.length === 1 ? '' : 's'} read ·{' '}
          <Figure method="xray-rails">{String(rails.length)}</Figure> bottleneck rails touched ·{' '}
          {unresolved.length} not read
          {data.weighted ? ' · weighted as given' : ' · equal weights'}
        </p>
        <div className="xray-actions">
          <button type="button" className="research-button-ghost" onClick={() => download(data)}>
            Download as CSV
          </button>
          {signedIn && rails.length > 0 && <UseMyRails slugs={rails.map((r) => r.slug)} />}
        </div>
      </div>

      {unresolved.length > 0 && (
        <div className="xray-block">
          <h2 className="xray-h2">Not read</h2>
          <ul className="xray-unresolved">
            {unresolved.map((u, i) => (
              <li key={`${u.input}-${i}`}>
                <code>{u.input}</code> — {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="xray-block">
        <h2 className="xray-h2">What the portfolio rests on</h2>
        <div className="xray-wrap">
          <table className="xray-table">
            <thead>
              <tr>
                <th scope="col">Bottleneck</th>
                <th scope="col">Share of weight</th>
                <th scope="col">Binding</th>
                <th scope="col">Pressure · {data.pressureWindowDays}d</th>
                <th scope="col">Holdings and how</th>
              </tr>
            </thead>
            <tbody>
              {rails.map((r) => (
                <tr key={r.slug}>
                  <td>
                    <Link href={bottleneckHref(r.slug)} className="xray-strong">
                      {r.bottleneck}
                    </Link>
                    <span className="xray-sub">{HORIZON_LABEL[r.horizon]}</span>
                  </td>
                  <td>
                    <Figure method="xray-weight">{pct(r.weight)}</Figure>
                  </td>
                  <td>
                    <Score r={r} />
                  </td>
                  <td>
                    <a href={methodHref('net-pressure')} className="xray-pressure">
                      {r.netPressure > 0 ? `+${r.netPressure}` : String(r.netPressure)}
                    </a>
                  </td>
                  <td className="xray-how">
                    {r.holdings.map((h) => (
                      <span key={h.label} className={`xray-chip is-${h.relation}`}>
                        {h.label} · {RELATION_LABEL[h.relation]}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="xray-grid">
        <div className="xray-block">
          <h2 className="xray-h2">Single-country bottlenecks</h2>
          <p className="xray-note">
            Share of weight on a bottleneck whose every recorded maker sits in one country.{' '}
            <Link href={methodHref('xray-country')}>Rule</Link>
          </p>
          {single.length === 0 ? (
            <p className="xray-note">None among these rails.</p>
          ) : (
            <ul className="xray-list">
              {single.map((c) => (
                <li key={c.country}>
                  <strong>{countryLabel(c.country)}</strong>{' '}
                  <Figure method="xray-country">{pct(c.allWeight)}</Figure> —{' '}
                  {c.allRails.join(', ')}
                </li>
              ))}
            </ul>
          )}
          <details className="xray-details">
            <summary>Every country with a recorded maker on these bottlenecks</summary>
            <ul className="xray-list">
              {countries.map((c) => (
                <li key={c.country}>
                  {countryLabel(c.country)}{' '}
                  <Figure method="xray-country">{pct(c.someWeight)}</Figure>
                </li>
              ))}
            </ul>
          </details>
        </div>
        <div className="xray-block">
          <h2 className="xray-h2">Sole makers and private suppliers</h2>
          {risks.length === 0 ? (
            <p className="xray-note">None recorded on these rails.</p>
          ) : (
            <ul className="xray-list">
              {risks.map((r) => (
                <li key={`${r.bottleneck}-${r.kind}-${r.company}`}>
                  <span className={`xray-risk is-${r.kind}`}>{RISK_LABEL[r.kind]}</span>{' '}
                  {r.company ? `${r.company} on ` : ''}
                  <Link href={bottleneckHref(r.slug)}>{r.bottleneck}</Link>
                  <span className="xray-sub">via {r.holdings.join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="xray-block">
        <h2 className="xray-h2">Holding by holding</h2>
        {holdings.map((h, i) => (
          <XrayHolding key={`${h.security.label}-${i}`} h={h} />
        ))}
      </div>

      <div className="xray-grid">
        <div className="xray-block">
          <h2 className="xray-h2">
            Reviewed events on these bottlenecks · {data.pressureWindowDays}d
          </h2>
          {events.length === 0 ? (
            <p className="xray-note">No reviewed event in the window.</p>
          ) : (
            <ul className="xray-list">
              {events.map((e) => (
                <li key={e.id}>
                  <span className={`xray-effect is-${e.effect}`}>{e.effect}</span>{' '}
                  <a href={e.source} rel="noopener noreferrer" target="_blank">
                    {e.headline}
                  </a>
                  <span className="xray-sub">
                    {e.date} · {e.bottleneck}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="xray-block">
          <h2 className="xray-h2">
            SEC filings by holders of these bottlenecks · {data.filingDays}d
          </h2>
          {data.filings === null ? (
            <p className="xray-note">Filings are not available right now.</p>
          ) : data.filings.length === 0 ? (
            <p className="xray-note">No filing in the window.</p>
          ) : (
            <ul className="xray-list">
              {data.filings.map((f) => (
                <li key={f.url}>
                  <a href={f.url} rel="noopener noreferrer" target="_blank">
                    {f.title}
                  </a>
                  <span className="xray-sub">
                    {f.at.slice(0, 10)} · {f.bottlenecks.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
