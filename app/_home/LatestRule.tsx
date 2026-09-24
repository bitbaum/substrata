import Link from 'next/link';

import type { Instrument } from '@/config/substrata-policy';
import { Empty, Heading } from '@/components/portal/Shell';
import { policyHref } from '@/lib/links';

/** Section 04: the newest rule tracked, and the way into the policy section. */
export function LatestRule({ latestRule }: { latestRule: Instrument | undefined }) {
  return (
    <section>
      <Heading index="04" title="Latest rule" />
      {latestRule ? (
        <Link
          href={policyHref(latestRule.jurisdiction)}
          className="block rounded-lg border border-subtle bg-surface-raised p-5 transition-colors hover:border-strong"
        >
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {latestRule.date} · {latestRule.body}
          </p>
          <p className="mt-2 font-medium text-fg-primary">{latestRule.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-fg-secondary">{latestRule.summary}</p>
        </Link>
      ) : (
        <Empty what="No rules tracked yet." />
      )}
      <p className="mt-3 text-sm">
        <Link href="/policy" className="text-accent underline-offset-4 hover:underline">
          Which rules slow building, and who asked for them →
        </Link>
      </p>
    </section>
  );
}
