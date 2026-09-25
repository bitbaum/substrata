import Link from 'next/link';
import type { Metadata } from 'next';

import { BOTTLENECK_NEEDS, ROLE_FAMILIES } from '@/config/careers-roles';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { facetCounts } from '@/lib/careers-query';
import { LEARNING_PATHS, pathsFor } from '@/lib/learning-paths';
import { OCCUPATION_SOURCES } from '@/lib/occupations';
import { Page, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { Occupations } from '../_parts/Occupations';
import { Paths } from '../_parts/Paths';
import { SkillCounts } from '../_parts/SkillCounts';
import '../careers.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Skills and training',
  description:
    'For each kind of work these chains hire for: what the official occupational records say it needs, what postings ask for, and public ways to train into it.',
};

async function skillsByFamily() {
  try {
    const totals = await facetCounts('family');
    const entries = await Promise.all(
      ROLE_FAMILIES.map(async (f) => [f.id, await facetCounts('skill', { family: f.id })] as const),
    );
    return { totals, skills: new Map(entries) };
  } catch {
    return null;
  }
}

export default async function PathsPage() {
  const counts = await skillsByFamily();
  const families = ROLE_FAMILIES.filter((f) => f.id !== 'business' && f.id !== 'software-ai');

  return (
    <Shell>
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/careers" className="hover:text-fg-primary">
            Careers
          </Link>
        </nav>
        <header className="careers-head">
          <p className="desk-kicker">Skills and training</p>
          <h1 className="desk-title">Train into the chain.</h1>
          <p className="desk-status">
            <Figure method="careers-paths">{String(LEARNING_PATHS.length)}</Figure> public
            programmes, each checked on its official page · occupational records from{' '}
            <a href={OCCUPATION_SOURCES.onet.url}>{OCCUPATION_SOURCES.onet.name}</a> and the{' '}
            <a href={OCCUPATION_SOURCES.esco.url}>{OCCUPATION_SOURCES.esco.name}</a>
          </p>
          <p className="careers-disclaimer">
            Three kinds of evidence, never blended: the official record of an occupation (O*NET,
            ESCO), what open postings name (counted, a mention not a requirement), and programmes
            (listed from their own pages, not reviewed). {OCCUPATION_SOURCES.onet.license}
          </p>
          <ul className="careers-terms">
            {families.map((f) => (
              <li key={f.id}>
                <a href={`#${f.id}`}>{f.label}</a>
              </li>
            ))}
          </ul>
        </header>

        {families.map((f) => {
          const skills = counts?.skills.get(f.id);
          const total = counts?.totals.get(f.id) ?? 0;
          const rails = BOTTLENECKS.filter((b) => BOTTLENECK_NEEDS[b.slug]?.includes(f.id));
          return (
            <section key={f.id} id={f.id} className="careers-section">
              <div className="careers-section-head">
                <h2>{f.label}</h2>
                <p>
                  <Link href={`/careers?family=${f.id}`}>
                    <Figure method="careers-classify" inLink>
                      {String(total)}
                    </Figure>{' '}
                    open roles →
                  </Link>
                </p>
              </div>
              <p className="careers-disclaimer">{f.who}</p>
              {rails.length > 0 && (
                <ul className="careers-terms">
                  {rails.map((b) => (
                    <li key={b.slug}>
                      <Link href={`/careers/${b.slug}`}>{b.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="careers-kicker careers-sub">Where to train</h3>
              <Paths paths={pathsFor([f.id])} />
              {skills && total > 0 && (
                <>
                  <h3 className="careers-kicker careers-sub">Named in open postings</h3>
                  <SkillCounts counts={skills} total={total} />
                </>
              )}
              <h3 className="careers-kicker careers-sub">The official record</h3>
              <Occupations family={f.id} />
            </section>
          );
        })}
      </Page>
    </Shell>
  );
}
