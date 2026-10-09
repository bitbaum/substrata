import Link from 'next/link';

/**
 * The front page's opening, and the only part of it a first visit must read:
 * what this is, in one line and one sentence, and the one thing to do.
 *
 * It used to be a two-clause title, a three-sentence lede, two buttons and a
 * status line about the sweep — a phone's whole first screen of reading
 * before the page had shown anything. The sweep's status now sits at the
 * foot (HomeFoot), where a reader who already cares will look for it, and
 * the floating Ask pill is the one Ask on the page.
 */
export function HomeHero() {
  return (
    <header className="home-hero">
      <h1 className="home-hero-title">What is holding technology back.</h1>
      <p className="home-hero-lede">
        The physical bottlenecks under faster compute, power, materials and machines — who makes
        each, which rule governs it, how sure we are — written down in public.
      </p>
      <div className="home-hero-actions">
        <Link href="/atlas" className="research-button">
          Open the map
        </Link>
      </div>
    </header>
  );
}
