import Link from 'next/link';

import { BOTTLENECKS } from '@/lib/bottlenecks';
import { exposureRows, isListed } from '@/lib/exposure';
import { parseExposureQuery, selectRows } from '@/lib/exposure-query';
import { filingItems, registrantsOn } from '@/lib/desk-filings';
import { filingsFor } from '@/lib/filings-store';
import { FORM_LABEL } from '@/lib/filings';
import { whenLabel } from '@/lib/when';
import type { FreshnessReport } from '@/lib/freshness/read';
import { XRAY_SAMPLE } from '@/lib/xray/examples';
import { HoldersList } from '@/components/roles/HoldersList';
import { XrayClient } from '@/components/xray/XrayClient';
import { FeedStatus, Rows, type Row } from '@/components/roles/RoleParts';
import { RoleSection } from '@/components/roles/RoleSection';
import { ScenarioLinks } from './ScenarioLinks';

const FILING_DAYS = 14;

async function recentFilings(): Promise<Row[] | null> {
  const registrants = registrantsOn(new Set(BOTTLENECKS.map((b) => b.name)));
  try {
    const filings = await filingsFor([...registrants.keys()], FILING_DAYS);
    return filingItems(filings, registrants)
      .slice(0, 8)
      .map((item) => ({
        key: item.id,
        title: item.title,
        href: item.url,
        external: true,
        meta: [
          item.source === 'filing' ? (FORM_LABEL[item.form] ?? item.form) : '',
          whenLabel(item.at),
          item.bottlenecks.join(', '),
        ]
          .filter(Boolean)
          .join(' · '),
      }));
  } catch {
    return null;
  }
}

/** X-ray first — it is the one thing here that starts from what the reader holds. */
export async function EquitiesView({
  report,
  signedIn,
}: {
  report: FreshnessReport;
  signedIn: boolean;
}) {
  const pressure = selectRows(
    exposureRows(),
    parseExposureQuery({ sort: 'pressure', listed: '1' }),
    null,
  )
    .filter(isListed)
    .slice(0, 8);
  const filings = await recentFilings();
  const feed = (id: string) => report.feeds.find((f) => f.feed.id === id);

  return (
    <div className="role-grid">
      <RoleSection
        index="01"
        title="X-ray your holdings"
        why="Paste tickers and see which bottlenecks each holding holds and rests on. Nothing you paste is stored."
        href="/xray"
        more="The full X-ray, with CSV and what it cannot see"
        wide
      >
        <XrayClient sample={XRAY_SAMPLE} signedIn={signedIn} />
      </RoleSection>
      <RoleSection
        index="02"
        title="Listed holders under the most pressure"
        why="Holders of a bottleneck that reviewed events have tightened most in the window, where their shares trade."
        href="/exposure?sort=pressure&listed=1"
        more="Every holder, filterable, with CSV"
      >
        <HoldersList rows={pressure} />
      </RoleSection>
      <RoleSection
        index="03"
        title={`SEC filings, last ${FILING_DAYS} days`}
        why="Current and periodic reports filed with the SEC by listed holders, under the bottlenecks they hold."
        href={signedIn ? '/account' : '/exposure'}
        more={signedIn ? 'Filings on your desk' : 'Who files: the exposure screen'}
        wide
        status={<FeedStatus row={feed('filings')} />}
      >
        {filings === null ? (
          <p className="role-empty">Filings could not be read just now.</p>
        ) : (
          <Rows rows={filings} empty="No filings by listed holders in the window." />
        )}
      </RoleSection>
      <RoleSection
        index="04"
        title="What if one fails?"
        why="Scenarios drawn from recorded events: which bottlenecks lose a maker, and which listed companies are exposed."
        href="/scenarios"
        more="Build any scenario"
      >
        <ScenarioLinks limit={6} />
        <p className="role-note">
          Public information only: no position, share of supply or revenue exposure is implied.{' '}
          <Link href="/about">What this is not</Link>.
        </p>
      </RoleSection>
    </div>
  );
}
