import Link from 'next/link';

import {
  INSTRUMENT_EFFECT_LABEL,
  INSTRUMENT_KIND_LABEL,
  INSTRUMENT_STATUS_LABEL,
  JURISDICTION_LABEL,
  type Instrument,
} from '@/config/substrata-policy';
import { bottleneckHref, marketHref, policyHref } from '@/lib/links';
import { hasMarketPage } from '@/lib/participants';

const EFFECT_DOT: Record<Instrument['effect'], string> = {
  tightens: 'bg-status-negative',
  loosens: 'bg-status-positive',
  mixed: 'bg-status-warning',
};

export function InstrumentCard({ instrument }: { instrument: Instrument }) {
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs tabular-nums text-fg-tertiary">{instrument.date}</span>
        <span className="inline-flex items-center gap-2 text-sm text-fg-secondary">
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${EFFECT_DOT[instrument.effect]}`}
          />
          {INSTRUMENT_EFFECT_LABEL[instrument.effect]}
        </span>
        <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
          {INSTRUMENT_KIND_LABEL[instrument.kind]}
        </span>
        <Link
          href={policyHref(instrument.jurisdiction)}
          className="font-mono text-xs uppercase tracking-caps text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
        >
          {JURISDICTION_LABEL[instrument.jurisdiction]}
        </Link>
        <span
          className={[
            'rounded-full border px-2 py-0.5 font-mono text-[0.68rem] uppercase tracking-caps',
            instrument.status === 'in-force'
              ? 'border-strong text-fg-secondary'
              : 'border-status-warning text-status-warning',
          ].join(' ')}
        >
          {INSTRUMENT_STATUS_LABEL[instrument.status]}
        </span>
      </div>

      <p className="mt-2 font-medium text-fg-primary">{instrument.title}</p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
        {instrument.summary}
      </p>

      {instrument.statusNote && (
        <p className="mt-2 max-w-prose text-xs leading-relaxed text-fg-tertiary">
          {instrument.statusNote}
        </p>
      )}

      {instrument.bottlenecks.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="font-mono uppercase tracking-caps text-fg-muted">Bears on</span>
          {instrument.bottlenecks.map((name) => (
            <Link
              key={name}
              href={bottleneckHref(name)}
              className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
            >
              {name}
            </Link>
          ))}
        </p>
      )}

      <div className="mt-2 text-xs">
        <span className="font-mono uppercase tracking-caps text-fg-muted">Asked for by · </span>
        {instrument.proponents.length === 0 ? (
          <span className="text-fg-tertiary">None identified</span>
        ) : (
          <span className="text-fg-secondary">
            {instrument.proponents.map((p, i) => (
              <span key={p.name}>
                {i > 0 && '; '}
                {hasMarketPage(p.name) ? (
                  <Link
                    href={marketHref(p.name)}
                    className="text-fg-primary underline-offset-4 hover:underline"
                  >
                    {p.name}
                  </Link>
                ) : (
                  <span className="text-fg-primary">{p.name}</span>
                )}{' '}
                (
                <a
                  href={p.source}
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  what they filed ↗
                </a>
                ) — {p.asked}
              </span>
            ))}
          </span>
        )}
      </div>

      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-fg-tertiary hover:text-fg-primary">Source</summary>
        <p className="mt-1 max-w-prose leading-relaxed text-fg-tertiary">“{instrument.quote}”</p>
        <p className="mt-1">
          <a
            href={instrument.source}
            rel="noreferrer"
            className="text-accent underline-offset-4 hover:underline"
          >
            {instrument.body} ↗
          </a>
          <span className="ml-2 text-fg-muted">
            {instrument.primary ? 'Official source' : 'Secondary source'} · read {instrument.readOn}
          </span>
        </p>
      </details>
    </li>
  );
}
