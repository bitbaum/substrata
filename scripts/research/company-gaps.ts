/**
 * Every company's static gaps as work-queue tasks: what its page cannot show
 * for want of an identifier or a relation, with the documents that would fill
 * it. Offline (committed evidence only); the page adds the gaps a live read
 * finds (a price source that refused, a filing that could not be read).
 *
 *   pnpm exec tsx scripts/research/company-gaps.ts            counts by box
 *   pnpm exec tsx scripts/research/company-gaps.ts out.json   also the tasks
 */
import { writeFile } from 'node:fs/promises';

import { staticUnknowns } from '@/lib/company-page/unknowns';
import { neighbours } from '@/lib/graph/index';
import { marketCompanyFor, noListingReason } from '@/lib/market-data/company';
import { universeEntries } from '@/lib/universe/store';

const admitted = universeEntries().filter((e) => e.admitted);
const tasks = admitted.flatMap((e) =>
  staticUnknowns({
    slug: e.slug,
    name: e.name,
    entry: e,
    listed: marketCompanyFor(e.slug) !== null,
    noListing: noListingReason(e.slug),
    relations: neighbours(`company:${e.slug}`).length,
  }).map((u) => u.task),
);
const byBox: Record<string, number> = {};
for (const t of tasks) byBox[t.box] = (byBox[t.box] ?? 0) + 1;
process.stdout.write(
  `${admitted.length} admitted companies, ${tasks.length} static gap tasks: ${JSON.stringify(byBox)}\n`,
);
const out = process.argv[2];
if (out)
  writeFile(out, `${JSON.stringify(tasks, null, 1)}\n`).then(() =>
    process.stdout.write(`written to ${out}\n`),
  );
