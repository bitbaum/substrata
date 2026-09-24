import type { Metadata } from 'next';

import { instrumentsNewestFirst, policyTotals } from '@/config/substrata-policy';
import { Heading, Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { ByJurisdiction } from './_sections/ByJurisdiction';
import { InstrumentCard } from './_sections/InstrumentCard';
import { Recommendations } from './_sections/Recommendations';

export const metadata: Metadata = {
  title: 'Policy',
  description:
    'The rules that speed up or slow down building: what each instrument does, to which bottleneck, and who publicly asked for it.',
};

export default function PolicyPage() {
  const totals = policyTotals();
  const all = instrumentsNewestFirst();
  const slowing = all.filter((i) => i.effect === 'tightens');
  const speeding = all.filter((i) => i.effect !== 'tightens');

  return (
    <Shell currentPath="policy">
      <Page>
        <SectionHeader
          title="Policy"
          lede="Most deliberate slowing of technology happens through rules rather than through physics. This is what those rules do, to which constraint, and who publicly asked for them."
          stats={[
            {
              label: 'Rules tracked',
              value: <Figure method="rules-tracked">{totals.instruments}</Figure>,
              note: (
                <>
                  across <Figure method="jurisdictions">{totals.jurisdictions}</Figure>{' '}
                  jurisdictions
                </>
              ),
            },
            {
              label: 'Slow building',
              value: <Figure method="rule-direction">{totals.tightening}</Figure>,
              note: 'controls, tariffs, safeguards',
            },
            {
              label: 'Speed building',
              value: <Figure method="rule-direction">{totals.loosening}</Figure>,
              note: 'permitting and process reform',
            },
            {
              label: 'With a named backer',
              value: <Figure method="rules-with-backer">{totals.withProponents}</Figure>,
              note: 'organisations that asked in their own words',
            },
          ]}
        />

        <div className="mb-8 rounded-lg border border-strong bg-surface-raised px-5 py-4">
          <p className="max-w-prose text-sm leading-relaxed text-fg-secondary">
            <span className="font-medium text-fg-primary">How this is kept honest.</span> Every rule
            here was fetched and read on the date shown, and carries one sentence from its own
            source. An organisation is named as having asked for a rule only where it says so in its
            own release, filing or testimony — never inferred from who benefits. Where nobody has
            been identified, the row says that rather than implying nobody asked.
          </p>
        </div>

        <section className="mb-14">
          <Heading
            index="01"
            title="Rules that slow building"
            aside={`${slowing.length} tracked, newest first`}
          />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {slowing.map((instrument) => (
              <InstrumentCard key={instrument.id} instrument={instrument} />
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <Heading
            index="02"
            title="Rules that speed building, or cut both ways"
            aside={`${speeding.filter((i) => i.effect === 'loosens').length} speed it · ${speeding.filter((i) => i.effect === 'mixed').length} both ways`}
          />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {speeding.map((instrument) => (
              <InstrumentCard key={instrument.id} instrument={instrument} />
            ))}
          </ul>
        </section>

        <ByJurisdiction />

        <Recommendations />
      </Page>
    </Shell>
  );
}
