import Link from 'next/link';

import { INSTRUMENTS, JURISDICTIONS } from '@/config/substrata-policy';
import { Heading } from '@/components/portal/Shell';
import { policyHref } from '@/lib/links';

/** Section 03: every jurisdiction, and how many of its rules cut each way. */
export function ByJurisdiction() {
  return (
    <section className="mb-14">
      <Heading index="03" title="By jurisdiction" />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-strong">
              {['Jurisdiction', 'What it decides here', 'Slowing', 'Speeding or mixed'].map(
                (c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={`py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary ${
                      i === 1 ? 'hidden sm:table-cell' : ''
                    }`}
                  >
                    {c}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {JURISDICTIONS.map((j) => {
              const mine = INSTRUMENTS.filter((i) => i.jurisdiction === j.id);
              return (
                <tr key={j.id} className="group align-top">
                  <td className="py-3 pr-4">
                    {mine.length > 0 ? (
                      <Link
                        href={policyHref(j.id)}
                        className="font-medium text-fg-primary underline-offset-4 group-hover:underline"
                      >
                        {j.name}
                      </Link>
                    ) : (
                      <span className="text-fg-tertiary">{j.name}</span>
                    )}
                  </td>
                  <td className="hidden max-w-md py-3 pr-4 text-sm text-fg-secondary sm:table-cell">
                    {j.detail}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs tabular-nums text-fg-secondary">
                    {mine.filter((i) => i.effect === 'tightens').length || '—'}
                  </td>
                  <td className="py-3 font-mono text-xs tabular-nums text-fg-secondary">
                    {mine.filter((i) => i.effect !== 'tightens').length || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-fg-muted">
        A jurisdiction with no number is one nothing has been researched for yet, not one with no
        rules.
      </p>
    </section>
  );
}
