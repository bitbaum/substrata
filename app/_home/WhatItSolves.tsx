import Link from 'next/link';

import { PROBLEM_SCALES, WHAT_IT_SOLVES } from '@/config/what-it-solves';
import { Heading } from '@/components/portal/Shell';

/**
 * "What it solves": concrete problems, one person's first, then society's.
 * Each card is the situation → what the site gives → the one page that does
 * it. The copy and the links are data (config/what-it-solves.ts), held to
 * pages that exist by test/what-it-solves.test.ts.
 */
export function WhatItSolves() {
  return (
    <section className="solves" aria-labelledby="what-it-solves">
      <Heading title={WHAT_IT_SOLVES.title} />
      <p className="solves-lede">{WHAT_IT_SOLVES.subtitle}</p>

      {PROBLEM_SCALES.map((scale) => (
        <div key={scale.id} className="solves-scale">
          <h3 className="solves-scale-title">{scale.title}</h3>
          <p className="solves-scale-sub">{scale.subtitle}</p>
          <ul className="solves-grid">
            {scale.items.map((item) => (
              <li key={item.id} className="solves-card">
                <span className="solves-who">{item.who}</span>
                <p className="solves-problem">{item.problem}</p>
                <p className="solves-gives">{item.gives}</p>
                <Link href={item.href} className="solves-go">
                  {item.cta} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="solves-cta">
        <p>{WHAT_IT_SOLVES.cta.lede}</p>
        <div className="solves-cta-actions">
          <Link href={WHAT_IT_SOLVES.cta.primary.href} className="research-button">
            {WHAT_IT_SOLVES.cta.primary.label}
          </Link>
          <Link href={WHAT_IT_SOLVES.cta.secondary.href} className="research-button-ghost">
            {WHAT_IT_SOLVES.cta.secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
