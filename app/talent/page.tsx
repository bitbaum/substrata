import Link from 'next/link';
import { Figure } from '@/components/portal/Figure';
import { JUDGED_BY } from '@/config/substrata-about';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { JOIN } from '@/config/substrata-join';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';
export const metadata = { title: 'Talent and expertise' };
export default function TalentPage() {
  const bottlenecks = BOTTLENECKS.filter((b) => b.stage === 'talent');
  return (
    <Shell currentPath="talent">
      <Page>
        <SectionHeader
          title="Some constraints are people"
          lede="The expertise needed to qualify a process, ramp a factory or connect a grid is part of the system. Help us make that knowledge visible."
        />
        <section className="research-prose">
          <h2>Looking for work in these chains?</h2>
          <p>
            This page is about expertise as a constraint. If you want a job in it, or to retrain
            into it, go to <Link href="/careers">Careers</Link>: open roles at the companies that
            hold the bottlenecks, which bottlenecks are hiring most, and{' '}
            <Link href="/careers/paths">skills and public training programmes</Link> for each kind
            of work.
          </p>
          <h2>Talent constraints in the research</h2>
          {bottlenecks.map((b) => (
            <article key={b.slug}>
              <h3>
                <Link href={bottleneckHref(b.slug)}>{b.name}</Link>
              </h3>
              <p>{b.plain}</p>
              <p>{b.rationale}</p>
              <p>
                Judged by {JUDGED_BY} · {b.judgedOn} · severity{' '}
                <Figure method="severity">{b.binding}/12</Figure> ·{' '}
                <Link href={bottleneckHref(b.slug)}>Inspect the evidence</Link> ·{' '}
                <Link href={`/careers/${b.slug}`}>Roles, skills and training</Link>
              </p>
            </article>
          ))}
          <h2>Contribute what you know</h2>
          <p>
            These are research needs, not vacancies. No employment, salary or consulting fee is
            promised. A correction, source or explanation of one practical constraint is useful.
          </p>
        </section>
        <div className="research-card-grid">
          {JOIN.roles.map((r) => (
            <article key={r.title}>
              <h2>{r.title}</h2>
              <p>{r.what}</p>
              <p>{r.why}</p>
              <Link href={`/chat?topic=${encodeURIComponent(r.title)}`}>
                Share your expertise →
              </Link>
              {r.example && <Link href={r.example}>Explore this research →</Link>}
            </article>
          ))}
        </div>
        <div className="research-prose">
          <h2>What happens to a contribution</h2>
          <p>
            Substrata chat can answer questions and, when you choose “Send to the research team”,
            save your message for review. You receive a receipt only after storage succeeds. You can
            choose whether to be credited and provide a reply address. Please share public or
            shareable information only.
          </p>
          <Link href="/chat">Talk to Substrata</Link>
        </div>
      </Page>
    </Shell>
  );
}
