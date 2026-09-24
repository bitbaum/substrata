import Link from 'next/link';

import { SCIENCE_QUERIES } from '@/config/substrata-pipeline';
import type { ExtraSection } from '@/components/portal/EntityProfile';
import { StageBar, StageLegend } from '@/components/science/StageBar';
import { ItemList } from '@/components/science/ItemList';
import { funnelFor } from '@/lib/science-pipeline';
import { funnelCounts, itemsFor } from '@/lib/science-read';
import { pipelineHref } from '@/lib/links';

/**
 * The "Science pipeline" section of a bottleneck page: the stage bar and the
 * newest collected items. Null when the bottleneck is not searched or the
 * feed cannot be read — the page then has no empty section to explain.
 */
export async function pipelineSection(b: {
  name: string;
  slug: string;
}): Promise<ExtraSection | null> {
  if (!(b.name in SCIENCE_QUERIES)) return null;
  try {
    const [counts, latest] = await Promise.all([funnelCounts(), itemsFor(b.name, null, 5)]);
    const cells = funnelFor(b.name, counts);
    const total = cells.reduce((n, c) => n + c.items, 0);
    return {
      id: 'science-pipeline',
      title: 'Science pipeline',
      importance: 52,
      evidence: `${total} papers, preprints and grants collected, unreviewed`,
      node: (
        <>
          <StageBar bottleneck={b.slug} cells={cells} />
          <StageLegend />
          {latest.length > 0 && <ItemList items={latest} />}
          <p className="mt-3 text-sm">
            <Link
              href={pipelineHref(b.slug)}
              className="text-accent underline-offset-4 hover:underline"
            >
              The full pipeline, by stage →
            </Link>
          </p>
        </>
      ),
    };
  } catch {
    return null;
  }
}
