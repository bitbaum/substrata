import Link from 'next/link';

import { AUDIENCES, audienceHref } from '@/config/audiences';
import { Heading } from '@/components/portal/Shell';

/**
 * Five doors: the reader says who they are and lands on the screens that
 * serve them, instead of having to know that the thing they need is called
 * "X-ray" or "pipeline".
 *
 * Rows, not cards. Five bordered cards of three lines each were a screen and
 * a half on a phone; a row is the door's name, one line of what is behind it
 * from `sm` up, and an arrow — the whole set fits under a thumb.
 */
export function ChooseRole() {
  return (
    <section className="role-choose" aria-labelledby="start-from-what-you-do">
      <Heading title="Start from what you do" />
      <ul className="door-list">
        {AUDIENCES.map((a) => (
          <li key={a.id}>
            <Link href={audienceHref(a.id)} className="door-row">
              <span className="door-row-who">{a.iAm}</span>
              <span className="door-row-hint">{a.hint}</span>
              <span className="door-row-go" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
