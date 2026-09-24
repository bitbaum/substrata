import Link from 'next/link';

import type { Bottleneck } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';

/** Four tests, each scored 0 to 3. */
export const BINDING_MAX = 4 * 3;

/** "12/12 = concentration 3 + substitution 3 + lead time 3 + inelasticity 3, judged …" */
export function scoreParts(b: Bottleneck): string {
  return `${b.binding}/${BINDING_MAX} = concentration ${b.score.concentration} + substitution ${b.score.substitution} + lead time ${b.score.leadTime} + inelasticity ${b.score.inelasticity} (each 0–3), judged ${b.judgedOn}`;
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
      <span>/{BINDING_MAX}</span>
    </Link>
  );
}
