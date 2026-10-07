import Link from 'next/link';

import {
  TAKE_PART_LABEL,
  TAKE_PART_LIMITS_HREF,
  TAKE_PART_NOT_ADVICE,
} from '@/config/substrata-take-part';
import type { TakePartRoute } from '@/lib/take-part';

/**
 * Work there, own part of it, buy from it — each with the rows behind it. The
 * not-advice line sits above the routes, not under them.
 */
export function TakePartSection({ routes }: { routes: TakePartRoute[] }) {
  return (
    <>
      <p className="mb-4 max-w-prose rounded-lg border border-subtle bg-surface-raised px-4 py-3 text-sm leading-relaxed text-fg-secondary">
        <span className="font-medium text-fg-primary">{TAKE_PART_NOT_ADVICE.lead}</span>{' '}
        {TAKE_PART_NOT_ADVICE.body}{' '}
        <Link href={TAKE_PART_LIMITS_HREF} className="text-accent hover:underline">
          What this is not
        </Link>
      </p>
      <dl className="divide-y divide-subtle border-y border-subtle">
        {routes.map((route) => (
          <div key={route.kind} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary sm:pt-0.5">
              {TAKE_PART_LABEL[route.kind]}
            </dt>
            <dd className="max-w-prose text-sm leading-relaxed text-fg-secondary">
              {route.text}
              {route.links.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {route.links.map((link) =>
                    link.external ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {link.label} ↗
                      </a>
                    ) : (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="text-accent hover:underline"
                      >
                        {link.label}
                      </Link>
                    ),
                  )}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
