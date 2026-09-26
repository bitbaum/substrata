import Link from 'next/link';

import { Empty, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';

/** Every unknown URL — a bottleneck, a resource, a company that is not in the corpus. */
export default function NotFound() {
  return (
    <Shell>
      <Page>
        <PageHeader kicker="Not found" title="Nothing lives at this address." />
        <Empty
          what="The page may have moved, or the name is not in the directory yet."
          action={
            <>
              <Link href="/search">Search the directory</Link>
              <Link href="/bottlenecks">Every bottleneck</Link>
              <Link href="/atlas?view=world">Resources on the map</Link>
              <Link href="/join">Suggest it, with a source</Link>
            </>
          }
        />
      </Page>
    </Shell>
  );
}
