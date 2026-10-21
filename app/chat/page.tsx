import type { Metadata, Viewport } from 'next';
import { ResearchChat } from '@/components/portal/ResearchChat';
import { Shell } from '@/components/portal/Shell';

export const metadata: Metadata = { title: 'Ask Substrata' };

export const viewport: Viewport = {
  interactiveWidget: 'resizes-content',
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const params = await searchParams;
  const topic = typeof params.topic === 'string' ? params.topic.slice(0, 200) : '';
  return (
    <Shell>
      <div className="companion-page">
        <ResearchChat topic={topic} />
      </div>
    </Shell>
  );
}
