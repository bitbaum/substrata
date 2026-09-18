import Link from 'next/link';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { evidenceTotals } from '@/lib/atlas';
import { EVIDENCE } from '@/config/substrata-evidence';
import { freshness } from '@/lib/sweep-store';

export const metadata = { title: 'Data quality and provenance' };

// One database round trip every five minutes rather than one per visit. The
// panel below describes a sweep that runs four times a day, so measuring it to
// within five minutes loses nothing and keeps the page cacheable.
export const revalidate = 300;

export default async function DataPage() {
  const t = evidenceTotals();
  // A failure to read the run record must not take down a page about
  // provenance. Null renders as "we cannot tell you", which is the honest
  // answer and is never the same as "nothing has happened".
  const sweep = await freshness().catch(() => null);
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
          <h2>How fresh is this</h2>
          {/* Two different questions that a single "updated" date conflates: what
              is the newest thing we hold, and when did we last go looking. A
              site that cannot tell them apart reports a quiet week when its
              search backend has been down for a fortnight. */}
          {sweep === null ? (
            <p>
              The sweep&rsquo;s run record could not be read just now, so this page cannot tell you
              when the research engine last looked. That is a failure to measure, not a report that
              nothing has happened.
            </p>
          ) : sweep.lastRunAt === null ? (
            <p>
              The research sweep has no completed run on record. Everything on this site is a
              standing record accepted by hand; nothing here has been checked against the web on a
              schedule yet.
            </p>
          ) : (
            <p>
              The research sweep last completed a run on{' '}
              {sweep.lastRunAt.slice(0, 16).replace('T', ' ')} UTC. It has looked at{' '}
              {sweep.nodesCovered} of {sweep.nodesTotal} bottlenecks at least once
              {sweep.blind > 0
                ? `, and could not look at ${sweep.blind} of them the last time it tried`
                : ''}
              . {sweep.openCandidates} lead{sweep.openCandidates === 1 ? '' : 's'}{' '}
              {sweep.openCandidates === 1 ? 'is' : 'are'} waiting to be read by a person.
            </p>
          )}
          <p>
            A lead found by the sweep is not a published record and never appears on a page. The
            corpus is files in version control, and a row reaches this site when a person has read
            the source and committed it. That is slower than a feed, on purpose: it is the
            difference between something that was checked and something that was merely found.
          </p>
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
