/**
 * Re-reads every source in research/series.json and checks that each point's
 * quote is still on the page.
 *
 *   pnpm tsx scripts/research/check-series.ts            # report
 *   pnpm tsx scripts/research/check-series.ts --strict   # exit 1 on any miss
 *
 * Not part of `verify`: it needs the network, and a publisher's outage is not
 * a broken build. Run it before committing new points; the scheduled quality
 * run (lib/quality/run.ts) re-reads a rotating sample with the same rule.
 * That the quote states the value is a pure check in lib/quality/checks-series.ts.
 * PDFs need `pdftotext` (poppler) on the PATH.
 */
import { corpusSeries } from '../../lib/series';
import { pageText, quoteOnPage } from '../../lib/quality/page-text';

async function main() {
  const strict = process.argv.includes('--strict');
  const pages = new Map<string, Promise<string>>();
  const read = (url: string, agent: string) => {
    const key = `${agent} ${url}`;
    if (!pages.has(key)) pages.set(key, pageText(url, agent));
    return pages.get(key)!;
  };
  let ok = 0;
  const problems: string[] = [];
  for (const series of corpusSeries()) {
    for (const point of series.points) {
      const { verdict, detail } = await quoteOnPage(point.source, point.quote ?? '', read);
      if (verdict === 'found') ok += 1;
      else
        problems.push(
          `${verdict === 'unreadable' ? `UNREACHABLE (${detail})` : 'MISS'}  ${series.id} ${point.date}  ${point.source}`,
        );
    }
  }
  console.log(`${ok} quotes found on their pages; ${problems.length} not`);
  for (const line of problems) console.log(line);
  if (strict && problems.length > 0) process.exit(1);
}

void main();
