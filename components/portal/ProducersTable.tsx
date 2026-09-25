import Link from 'next/link';

import type { EvidenceCandidate } from '@/config/substrata-evidence';
import type { Bottleneck } from '@/lib/bottlenecks';
import { marketHref } from '@/lib/links';
import { listingForName } from '@/lib/listings';
import { openCandidatesFor } from '@/lib/source-store';
import { Ticker } from '@/components/exposure/Ticker';
import { Status } from './Status';

/**
 * Who makes a bottleneck, and how each row is evidenced.
 *
 * "Verified" comes from the corpus (git). "Found, unchecked" comes live from
 * the one producer-sourcing queue, `research_source_candidates`, which the box
 * timer fills every six hours — read here, at request time, so the page never
 * shows a stale copy of it. When the queue cannot be read (build, CI, outage)
 * the table says so rather than implying the engine found nothing.
 */
export async function ProducersTable({ b }: { b: Bottleneck }) {
  const unsourced = b.producers.filter((p) => !p.source).length;
  const live = unsourced > 0 ? await openCandidatesFor(b.name) : new Map();
  const found = live
    ? b.producers.filter((p) => !p.source && (live.get(p.name)?.length ?? 0) > 0).length
    : 0;

  return (
    <>
      {unsourced > 0 && (
        <p className="mb-3 max-w-prose text-xs text-fg-tertiary">
          {live
            ? `${found} of ${unsourced} unsourced rows have pages the sourcing engine found that nobody has checked yet.`
            : 'The sourcing queue could not be read just now; unchecked pages are not shown.'}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-strong">
              {['Organisation', 'Where', 'Step', 'Evidence'].map((column, i) => (
                <th
                  key={column}
                  scope="col"
                  className={`py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary ${
                    i === 1 ? 'hidden sm:table-cell' : ''
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {b.producers.map((p) => (
              <tr key={p.name} className="group align-top">
                <td className="py-3 pr-4">
                  <Link
                    href={marketHref(p.name)}
                    className="text-fg-primary underline-offset-4 group-hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="mt-1 block text-xs">
                    <Ticker listing={listingForName(p.name)} compact />
                  </span>
                </td>
                <td className="hidden py-3 pr-4 font-mono text-xs tabular-nums text-fg-secondary sm:table-cell">
                  {p.jurisdictions.join(' ')}
                </td>
                <td className="py-3 pr-4 text-sm text-fg-secondary">{p.role}</td>
                <td className="py-3 text-sm">
                  <Evidence source={p.source} candidates={live?.get(p.name) ?? []} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Evidence({
  source,
  candidates,
}: {
  source: string | null;
  candidates: EvidenceCandidate[];
}) {
  if (source) {
    return (
      <a
        href={source}
        className="inline-flex items-center gap-2 text-accent underline-offset-4 hover:underline"
        rel="noreferrer"
      >
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-status-positive" />
        Verified source ↗
      </a>
    );
  }
  if (candidates.length === 0) return <Status state="unverified" />;
  return (
    <details>
      <summary className="inline-flex cursor-pointer items-center gap-2 text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-status-warning" />
        {candidates.length} found, unchecked
      </summary>
      <ul className="mt-2 space-y-3">
        {candidates.map((c) => (
          <li key={c.url} className="max-w-prose">
            <a
              href={c.url}
              rel="noreferrer"
              className="text-accent underline-offset-4 hover:underline"
            >
              {c.title || c.url} ↗
            </a>
            <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">“{c.excerpt}”</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
