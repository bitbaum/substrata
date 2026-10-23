/**
 * The bottlenecks that need this resource, worst first, each with its
 * severity meter — the same 0–12 judgement the bottleneck page shows, so a
 * reader lands on a resource and sees at once what it holds up. One row
 * anatomy with the company rows on a country: name, the line under it, the
 * figure on the right.
 */
import Link from 'next/link';
import { Meter } from '@bitbaum/chartkit/react';

import { HORIZON_LABEL } from '@/config/substrata-assessment';
import { bottleneckHref } from '@/lib/links';
import type { ResourceProfile } from '@/lib/resources/profile';

export function ResourceUsers({ profile }: { profile: ResourceProfile }) {
  if (profile.users.length === 0) return null;
  return (
    <>
      <ul className="place-rows">
        {profile.users.map((b) => (
          <li key={b.slug} className="place-row">
            <Link href={bottleneckHref(b.slug)} className="place-row-name">
              {b.name}
            </Link>
            <p className="place-row-detail">
              {b.plain} · {HORIZON_LABEL[b.horizon]}
            </p>
            <span className="place-row-aside">
              <Meter value={b.binding} max={12} label={`Severity of ${b.name}`} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
        Severity is an analyst judgement — concentration, substitution, lead time and inelasticity,
        each scored and summed, the meter full at the worst — dated on each bottleneck’s page; it is
        not a measurement of this resource.
      </p>
    </>
  );
}
