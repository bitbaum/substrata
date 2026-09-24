import Link from 'next/link';

import type { Bottleneck } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';

/** "12/12 = concentration 3 + substitution 3 + lead time 3 + inelasticity 3, judged …" */
export function scoreParts(b: Bottleneck): string {
  return `${b.binding}/12 = concentration ${b.score.concentration} + substitution ${b.score.substitution} + lead time ${b.score.leadTime} + inelasticity ${b.score.inelasticity} (each 0–3), judged ${b.judgedOn}`;
}

/** A binding score that says what it is made of, and links to the assessment. */
export function BindingScore({ b, prefix = '' }: { b: Bottleneck; prefix?: string }) {
  return (
    <Link
      href={`${bottleneckHref(b.slug)}#assessment`}
      className="desk-score"
      title={scoreParts(b)}
    >
      {prefix}
      {b.binding}
      <span>/12</span>
    </Link>
  );
}
