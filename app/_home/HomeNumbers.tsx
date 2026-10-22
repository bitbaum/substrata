import Link from 'next/link';

import type { PolicyTotals } from '@/config/substrata-policy';
import { SCIENCE } from '@/config/substrata-science';
import type { PortalTotals } from '@/lib/bottlenecks';

/**
 * Four counts in one strip: equal cells, one shape (the figure, then what it
 * counts), and each cell is a link to the page that holds the rows behind it.
 * No notes under the figures — those made the cells different heights, and
 * the pages they link to say what each number means.
 */
export function HomeNumbers({ totals, policy }: { totals: PortalTotals; policy: PolicyTotals }) {
  const cells: { label: string; value: string | number; href: string }[] = [
    { label: 'Bottlenecks mapped', value: totals.bottlenecks, href: '/bottlenecks' },
    { label: 'Maker rows sourced', value: `${totals.sourced}/${totals.producers}`, href: '/data' },
    { label: 'Rules tracked', value: policy.instruments, href: '/policy' },
    { label: 'Possible fixes', value: SCIENCE.length, href: '/science' },
  ];
  return (
    <section className="home-section" aria-label="The corpus in numbers">
      <ul className="home-numbers">
        {cells.map((cell) => (
          <li key={cell.label}>
            <Link href={cell.href} className="home-number">
              <span className="home-number-value">{cell.value}</span>
              <span className="home-number-label">{cell.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
