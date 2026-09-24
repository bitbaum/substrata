import { JURISDICTION_LABEL, RECOMMENDATIONS } from '@/config/substrata-policy';
import { Empty, Heading } from '@/components/portal/Shell';

/** Section 04: this project's own recommendations, each with its falsifier. */
export function Recommendations() {
  return (
    <section>
      <Heading
        index="04"
        title="What we would change"
        aside="This project's own view, with what would prove it wrong"
      />
      {RECOMMENDATIONS.length === 0 ? (
        <Empty what="No recommendations published yet." />
      ) : (
        <ul className="divide-y divide-subtle border-y border-subtle">
          {RECOMMENDATIONS.map((rec) => (
            <li key={rec.id} className="py-5">
              <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {JURISDICTION_LABEL[rec.jurisdiction]} · decided by {rec.decider}
              </p>
              <p className="mt-2 max-w-prose font-medium text-fg-primary">{rec.change}</p>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                {rec.because}
              </p>
              <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                    Expected effect
                  </dt>
                  <dd className="mt-0.5 max-w-prose leading-relaxed text-fg-secondary">
                    {rec.expectedEffect}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                    What would show this is wrong
                  </dt>
                  <dd className="mt-0.5 max-w-prose leading-relaxed text-fg-secondary">
                    {rec.falsifier}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
