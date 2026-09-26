import Link from 'next/link';
import type { Metadata } from 'next';

import { facetCounts } from '@/lib/careers-query';
import { BOARDS_CHECKED_ON, hiringDirectory } from '@/lib/job-boards';
import { Page, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import '../careers.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Where each company hires',
  description:
    'Every company in the directory and where its open roles are published: a public board Substrata reads daily, or its own careers page.',
};

const ATS_LABEL: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  successfactors: 'SAP SuccessFactors',
  smartrecruiters: 'SmartRecruiters',
  taleo: 'Oracle Taleo',
  icims: 'iCIMS',
  'in-house': 'Own site',
  unknown: 'Not found',
};

function atsLabel(ats: string | undefined): string {
  if (!ats) return 'Not checked';
  return ATS_LABEL[ats] ?? ats.replace(/^other:/, '').replace(/^\w/, (c) => c.toUpperCase());
}

export default async function CompaniesHiringPage() {
  const rows = hiringDirectory();
  const open = await facetCounts('company').catch(() => new Map<string, number>());
  const live = rows.filter((r) => r.live).length;

  return (
    <Shell>
      <Page>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
          <Link href="/careers" className="hover:text-fg-primary">
            Careers
          </Link>
        </nav>
        <header className="careers-head">
          <p className="desk-kicker">Where each company hires</p>
          <h1 className="desk-title">Every careers page in the directory.</h1>
          <p className="desk-status">
            <Figure method="careers-open">{String(live)}</Figure> of{' '}
            <Figure method="careers-open">{String(rows.length)}</Figure> companies publish on a
            board Substrata can read daily; the rest are linked to their own careers page · checked{' '}
            {BOARDS_CHECKED_ON}
          </p>
          <p className="careers-disclaimer">
            A board is read only where the company&rsquo;s own careers page leads to it and the
            system publishes a documented public API that its robots.txt allows (Greenhouse, Lever,
            Ashby). Workday, SuccessFactors, SmartRecruiters and in-house sites are linked, never
            scraped. A unit that hires through its parent links to the parent&rsquo;s page.
          </p>
        </header>
        <div className="careers-table-wrap">
          <table className="careers-table">
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Published on</th>
                <th scope="col">Open roles read</th>
                <th scope="col">Careers page</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <td>
                    <Link href={`/markets/${r.slug}`}>{r.name}</Link>
                  </td>
                  <td>{atsLabel(r.record?.ats)}</td>
                  <td>
                    {r.live ? (
                      <Link href={`/careers?company=${r.slug}`}>
                        <Figure method="careers-open" inLink>
                          {String(open.get(r.slug) ?? 0)}
                        </Figure>
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {r.record?.careersUrl ? (
                      <a
                        href={r.record.careersUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={r.record.evidence}
                      >
                        {new URL(r.record.careersUrl).hostname.replace(/^www\./, '')} ↗
                      </a>
                    ) : (
                      'Not found'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Page>
    </Shell>
  );
}
