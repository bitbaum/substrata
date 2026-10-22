import Link from 'next/link';

import { AUDIENCES, audienceHref } from '@/config/audiences';
import { Heading } from '@/components/portal/Shell';

/**
 * Five doors: the reader says who they are and lands on the screens that
 * serve them, instead of having to know that what they need is called
 * "X-ray" or "pipeline". Rows of one anatomy: the door's name, one line of
 * what is behind it, a chevron at the right.
 */
export function Doors() {
  return (
    <section className="home-section" aria-labelledby="start-from-what-you-do">
      <Heading title="Start from what you do" />
      <ul className="home-doors">
        {AUDIENCES.map((a) => (
          <li key={a.id}>
            <Link href={audienceHref(a.id)} className="home-door">
              <span className="home-door-who">{a.iAm}</span>
              <span className="home-door-hint">{a.hint}</span>
              <span className="home-door-go" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
