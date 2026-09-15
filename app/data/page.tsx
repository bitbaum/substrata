import Link from 'next/link';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { evidenceTotals } from '@/lib/atlas';
import { EVIDENCE } from '@/config/substrata-evidence';

export const metadata = { title: 'Data quality and provenance' };
export default function DataPage() {
  const t = evidenceTotals();
  return (
    <Shell currentPath="data">
      <Page>
        <SectionHeader
          title="Every claim should be checkable"
          lede="See what has a source, what is still a lead, and what comes from analyst judgement. These counts are computed from the same records used by the atlas and company pages."
          stats={[
            { label: 'Producer rows', value: t.producerRows },
            { label: 'Sourced', value: t.sourced },
            { label: 'Candidate sources', value: t.candidate },
            { label: 'Unverified', value: t.unverified },
          ]}
        />
        <div className="research-prose">
          <h2>Three different kinds of evidence</h2>
          <p>
            A sourced producer row links to an accepted primary source. A candidate source has been
            found by the research engine but still needs review. An unverified lead has neither. A
            sourced row establishes the specific claim next to its link; it does not verify the
            whole company profile.
          </p>
          <h2>Judgements are labelled</h2>
          <p>
            The {t.assessments} binding assessments sum four ordinal judgements, each from zero to
            three: concentration, substitution, lead time and inelasticity. A total of twelve is not
            a percentage or a probability. The latest assessment date in the corpus is{' '}
            {t.latestAssessment}. Stage relief times are illustrative analyst estimates, not
            measured lead-time datasets.
          </p>
          <h2>Dates and reproducibility</h2>
          <p>
            The evidence engine last recorded a run at {EVIDENCE.generatedAt ?? 'no recorded date'}.
            Export time tells you when a file was generated, not when its claims were verified. The
            export includes a SHA-256 content digest so you can identify an exact dataset and
            reproduce counts.
          </p>
          <h2>Correct the record</h2>
          <p>
            Send the claim, a public source, its date, and the proposed correction to{' '}
            <Link href="/chat">Substrata chat</Link>. Contributions enter review; sending a message
            does not turn it into a verified fact.
          </p>
          <h2>Use the data</h2>
          <p>
            <a href="/api/research/export" download>
              Download versioned JSON
            </a>{' '}
            ·{' '}
            <a href="/api/research/export?format=csv" download>
              Download bottlenecks as CSV
            </a>{' '}
            · <Link href="/atlas">Explore the atlas</Link>
          </p>
        </div>
      </Page>
    </Shell>
  );
}
