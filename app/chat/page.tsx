import type { Metadata, Viewport } from 'next';
import { ResearchChat } from '@/components/portal/ResearchChat';
import { Shell } from '@/components/portal/Shell';
import { startQuestion } from '@/lib/home-asks';
import { homeAsks, seedFor, starters } from '@/lib/starters';
import { headers } from 'next/headers';

export const metadata: Metadata = { title: 'Ask Substrata' };

export const viewport: Viewport = {
  interactiveWidget: 'resizes-content',
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const topic = typeof params.topic === 'string' ? params.topic.slice(0, 200) : '';
  // The empty screen's questions: the day's, seeded with where the reader came
  // from, and never the four tiles the front page just showed.
  const now = new Date();
  const from = referrerPath((await headers()).get('referer'));
  const asks = starters({
    seed: seedFor(now, from),
    exclude: homeAsks(seedFor(now)).map((a) => a.question),
  });
  return (
    <Shell footer={false}>
      {/* On the chat the Loki feedback launcher is the slim edge tab, not the
          round button that sat on the reply row (2026-10-23). "tab", not
          "hidden": a hidden launcher makes the owner's widget fall back to a
          bar across the top of the page, a different widget from the one on
          every other page. The widget's host directive for this region, left
          behind with the route. */}
      <div className="companion-page" data-fc-place="tab">
        <ResearchChat topic={topic} start={startQuestion(params.q)} starters={asks} />
      </div>
    </Shell>
  );
}

/** The path of the page the reader came from, or "chat" when there is none or it is elsewhere. */
function referrerPath(referer: string | null): string {
  try {
    return referer ? new URL(referer).pathname || 'chat' : 'chat';
  } catch {
    return 'chat';
  }
}
