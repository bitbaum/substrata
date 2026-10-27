import Link from 'next/link';

import type { HomeAsk } from '@/lib/home-asks';
import { AskBox } from './AskBox';

/**
 * The front page opens the way a new chat does in the ChatGPT and Claude
 * apps: a short question, ONE large box — the same `AskComposer` /chat uses,
 * so what you see is what you get: "+" for a screenshot, microphone, send —
 * and a few questions to start from. Sending opens /chat at once with the
 * message and its attachments. The map is the quiet way in for someone who
 * would rather look than ask.
 */
export function HomeHero({ asks }: { asks: readonly HomeAsk[] }) {
  return (
    <header className="home-hero">
      <h1 className="home-hero-title">What is holding technology back?</h1>
      <p className="home-hero-lede">
        Ask about compute, power, materials or machines — or add a screenshot of something you read,
        and its claims are checked. Every answer links what it read.
      </p>
      <AskBox asks={asks} />
      <Link href="/atlas" className="home-hero-map">
        Or open the map <span aria-hidden>→</span>
      </Link>
    </header>
  );
}
