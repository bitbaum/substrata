import React from 'react';
import Link from 'next/link';

import { SCARCITY_DETAIL } from '@/config/substrata-participants';
import { SCARCITY_LABEL, type MarketParticipant } from '@/lib/participants';
import { bottleneckHref, marketsBy } from '@/lib/links';
import { bindingSum, type CompanyProfile } from '@/lib/company-profile';
import { Figure } from '@/components/portal/Figure';

function Fact({
  label,
  value,
  note,
  href,
  title,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  href?: string;
  title?: string;
}) {
  const inner = (
    <>
      <span className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">{label}</span>
      <span className="mt-1 block font-heading text-2xl font-semibold tabular-nums text-fg-primary">
        {value}
      </span>
      {note && <span className="mt-0.5 block text-xs leading-snug text-fg-tertiary">{note}</span>}
    </>
  );
  const cls = 'block bg-surface-raised px-4 py-3';
  return href ? (
    <Link href={href} title={title} className={`${cls} group hover:bg-surface-page`}>
      {inner}
    </Link>
  ) : (
    <div title={title} className={cls}>
      {inner}
    </div>
  );
}

/**
 * The derived figures under a company's name. Each links to the rows it
 * counts or to the assessment it sums.
 */
export function CompanyFacts({ p, profile }: { p: MarketParticipant; profile: CompanyProfile }) {
  const { held, soleRecorded, hardest } = profile;
  const related = profile.relatedEvents.length;
  return (
    <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1">
      <Fact
        label="Bottlenecks held"
        value={
          <>
            <Figure method="bottlenecks-held" inLink>
              {held.length}
            </Figure>
            <span className="text-sm font-normal text-fg-muted">
              {' '}
              of {profile.trackedBottlenecks}
            </span>
          </>
        }
        note={
          held.length === 0
            ? 'none of the tracked rows'
            : soleRecorded.length > 0
              ? `${soleRecorded.length} with no other maker recorded`
              : 'each with another maker recorded'
        }
        href={held.length > 0 ? '#chokepoints' : '/bottlenecks'}
      />
      {hardest && (
        <Fact
          label="Hardest binding"
          value={
            <>
              <Figure
                inLink
                estimate={{
                  by: 'Substrata',
                  on: hardest.bottleneck.judgedOn,
                  basis: bindingSum(hardest.bottleneck),
                }}
              >
                {hardest.bottleneck.binding}
              </Figure>
              <span className="text-sm font-normal text-fg-muted">/12</span>
            </>
          }
          note={`${hardest.bottleneck.name} · judged ${hardest.bottleneck.judgedOn}`}
          href={`${bottleneckHref(hardest.bottleneck.slug)}#severity`}
          title={bindingSum(hardest.bottleneck)}
        />
      )}
      {p.scarcity && (
        <Fact
          label="Directory grade"
          value={<span className="text-xl">{SCARCITY_LABEL[p.scarcity]}</span>}
          note="a judgement, not a sourced fact"
          href={marketsBy('grade', p.scarcity)}
          title={SCARCITY_DETAIL[p.scarcity]}
        />
      )}
      {(profile.events.length > 0 || related > 0) && (
        <Fact
          label="Events"
          value={
            <Figure method="company-events" inLink>
              {profile.events.length}
            </Figure>
          }
          note={related > 0 ? `name it · ${related} more on what it holds` : 'name it'}
          href="#events"
        />
      )}
    </div>
  );
}
