import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { DEPENDENCIES, DEPENDENCY_GAPS } from '@/config/substrata-dependencies';
import { currentSession } from '@/lib/auth';
import { LISTINGS } from '@/lib/listings';
import { methodHref } from '@/lib/methods';
import { Page, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { PageHeader } from '@/components/portal/PageHeader';
import { XrayClient } from '@/components/xray/XrayClient';
import { XRAY_FORMS as FORMS, XRAY_SAMPLE as SAMPLE } from '@/lib/xray/examples';
import './xray.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Portfolio X-ray',
  description:
    'Paste holdings and see which bottlenecks each one holds and rests on, the sole makers and private suppliers behind them, and the countries they sit in. Nothing you paste is stored.',
};

export default async function XrayPage() {
  const session = await currentSession();
  return (
    <Shell>
      <Page>
        <PageHeader
          kicker="Portfolio X-ray"
          title="What your holdings rest on."
          status={
            <>
              Paste tickers as a terminal or broker writes them —{' '}
              {FORMS.map((f, i) => (
                <React.Fragment key={f}>
                  {i > 0 ? ', ' : ''}
                  <code>{f}</code>
                </React.Fragment>
              ))}{' '}
              — or read a CSV. You get the biggest single-source risk, the countries your weight
              rests on, and every holding traced through{' '}
              <Figure method="xray-rails">{String(DEPENDENCIES.length)}</Figure> sourced dependency
              rows (listings checked {LISTINGS.checkedOn}).
            </>
          }
          note={
            <details className="xray-privacy">
              <summary>
                <strong>Nothing you paste is kept.</strong> How
              </summary>
              Holdings are sent once in the body of a request, analysed in memory and discarded: no
              database write, no log line, no URL that carries them, no cookie. The CSV is built in
              your browser from the answer already on screen. Signed-in readers can copy the
              resulting bottlenecks — not the holdings — to their desk.
            </details>
          }
        />

        <XrayClient sample={SAMPLE} signedIn={Boolean(session?.actorId)} />

        <aside className="xray-block xray-limits">
          <h2 className="xray-h2">What this can and cannot see</h2>
          <p className="xray-note">
            Public information only. The corpus records who holds a bottleneck and which
            dependencies a source states, not how much of a company&rsquo;s revenue or value rests
            on any of them, so every share on this page is a share of <em>your</em> pasted weight,
            not an exposure estimate. Upstream routes follow only recorded rows (
            <Link href={methodHref('xray-rails')}>rule</Link>). Joins not recorded yet:
          </p>
          <ul className="xray-list">
            {DEPENDENCY_GAPS.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          <p className="xray-note">
            A wrong or missing join? <Link href="/join">Tell us with a source</Link>. Want the
            reverse question — what breaks if one of these fails?{' '}
            <Link href="/scenarios">Scenarios</Link>.
          </p>
        </aside>
      </Page>
    </Shell>
  );
}
