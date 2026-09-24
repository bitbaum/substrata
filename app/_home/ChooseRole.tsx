import Link from 'next/link';

import { AUDIENCES, audienceHref } from '@/config/audiences';
import { Heading } from '@/components/portal/Shell';

/**
 * Five doors, straight under the hero: the reader says who they are and
 * lands on the screens that serve them, instead of having to know that the
 * thing they need is called "X-ray" or "pipeline".
 */
export function ChooseRole() {
  return (
    <section className="role-choose" aria-labelledby="choose-role">
      <Heading title="Start from what you do" />
      <ul className="role-choose-grid" id="choose-role">
        {AUDIENCES.map((a) => (
          <li key={a.id}>
            <Link href={audienceHref(a.id)} className="role-door">
              <span className="role-door-who">{a.iAm}</span>
              <span className="role-door-gets">{a.serves.join(' · ')}</span>
              <span className="role-door-go">Open your view →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
