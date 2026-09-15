import { ResearchChat } from '@/components/portal/ResearchChat';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
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
      <Page>
        <SectionHeader
          title="A research companion, wherever you are"
          lede="Ask Substrata to explain a chain, find a company, or unpack the evidence. Share corrections and expertise directly with the research team."
        />
        <ResearchChat topic={topic} />
      </Page>
    </Shell>
  );
}
