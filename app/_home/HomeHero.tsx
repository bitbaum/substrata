import Link from 'next/link';

import type { HomeAsk } from '@/lib/home-asks';
import { AskBox } from './AskBox';

/**
 * The front page's opening: what this is in one line and one sentence, then
 * the thing to do — ask. The Ask box is the page's one primary action; the
 * map is the quiet way in for someone who would rather look than ask.
 */
export function HomeHero({ asks }: { asks: readonly HomeAsk[] }) {
  return (
    <header className="home-hero">
      <h1 className="home-hero-title">What is holding technology back.</h1>
      <p className="home-hero-lede">
        The physical bottlenecks under faster compute, power, materials and machines — who makes
        each, which rule governs it, how sure we are — written down in public.
      </p>
      <AskBox asks={asks} />
      <Link href="/atlas" className="home-hero-map">
        Or open the map <span aria-hidden>→</span>
      </Link>
    </header>
  );
}
