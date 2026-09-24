import Link from 'next/link';

import { PIPELINE_STAGE_LABEL } from '@/config/substrata-pipeline';
import { Figure } from '@/components/portal/Figure';
import { Ticker } from '@/components/exposure/Ticker';
import { KIND_LABEL, SOURCE_LABEL, snippet } from '@/lib/science';
import type { StoredItem } from '@/lib/science-read';
import { matchDirectory } from '@/lib/science-pipeline';
import { bottleneckHref, marketHref, pipelineOrgHref } from '@/lib/links';

function money(amount: number, currency: string | null): string {
  return `${currency ?? ''} ${Math.round(amount).toLocaleString('en-US')}`.trim();
}

/** Who did it: institutions as the source names them, companies joined to the directory. */
function Institutions({ item }: { item: StoredItem }) {
  if (item.institutions.length === 0) return null;
  return (
    <p className="sci-orgs">
      {item.institutions.slice(0, 5).map((inst) => {
        const match = matchDirectory(inst.name);
        return (
          <span key={inst.name} className="sci-org">
            <Link href={pipelineOrgHref(inst.name)} className="sci-org-name">
              {inst.name}
            </Link>
            {match && (
              <>
                <Link href={marketHref(match.rows[0].slug)} className="sci-org-directory">
                  {match.name} in the directory
                </Link>
                <Ticker listing={match.listing} compact />
              </>
            )}
          </span>
        );
      })}
      {item.institutions.length > 5 && (
        <span className="sci-org-more">+{item.institutions.length - 5} more</span>
      )}
    </p>
  );
}

export function ItemList({
  items,
  showBottleneck = false,
}: {
  items: StoredItem[];
  showBottleneck?: boolean;
}) {
  return (
    <ul className="sci-list">
      {items.map((item) => (
        <li key={`${item.bottleneck}-${item.id}`} className="sci-item">
          <p className="sci-meta">
            <span className="sci-kind">{KIND_LABEL[item.kind]}</span>
            {item.publishedOn && <time dateTime={item.publishedOn}>{item.publishedOn}</time>}
            {item.venue && <span className="sci-venue">{item.venue}</span>}
            {item.funder && <span>{item.funder}</span>}
            {item.programme && <span>{item.programme}</span>}
            {item.citations !== null && (
              <span>
                <Figure source={item.url} sourceLabel={`${SOURCE_LABEL[item.source]}, as fetched`}>
                  {item.citations}
                </Figure>{' '}
                citations
              </span>
            )}
            {item.amount !== null && item.amount > 0 && (
              <span>
                <Figure source={item.url} sourceLabel={SOURCE_LABEL[item.source]}>
                  {money(item.amount, item.currency)}
                </Figure>
              </span>
            )}
            {showBottleneck && (
              <Link href={bottleneckHref(item.bottleneck)} className="sci-rail">
                {item.bottleneck}
              </Link>
            )}
          </p>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="sci-title">
            {item.title}
            <span aria-hidden> ↗</span>
          </a>
          {item.abstract && <p className="sci-abstract">{snippet(item.abstract)}</p>}
          <Institutions item={item} />
          <p className="sci-foot">
            <span title={item.stageWhy}>
              {PIPELINE_STAGE_LABEL[item.stage]} · {item.stageWhy}
            </span>
            <span className="sci-unreviewed">
              From {SOURCE_LABEL[item.source]} · not yet reviewed
            </span>
            {item.doi && (
              <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer">
                DOI
              </a>
            )}
            {item.pdfUrl && (
              <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">
                PDF
              </a>
            )}
            {item.alsoUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                also at {new URL(url).hostname.replace(/^www\./, '')}
              </a>
            ))}
          </p>
        </li>
      ))}
    </ul>
  );
}
