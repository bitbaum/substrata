import { ResearchChat } from '@/components/portal/ResearchChat';
import { Shell } from '@/components/portal/Shell';

export const metadata = { title: 'Ask Substrata' };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const params = await searchParams;
  const topic = typeof params.topic === 'string' ? params.topic.slice(0, 200) : '';
  return (
    <Shell currentPath="chat">
      <div className="companion-page">
        <ResearchChat topic={topic} />
      </div>
    </Shell>
  );
}
