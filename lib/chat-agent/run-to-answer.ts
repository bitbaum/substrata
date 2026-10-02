import { runAgent, type AgentAnswer } from './loop';

/** Run to completion and return the final answer — for callers that do not stream. */
export async function runAgentToAnswer(
  input: Omit<Parameters<typeof runAgent>[0], 'emit'>,
): Promise<AgentAnswer> {
  let done: AgentAnswer | undefined;
  let failure = 'The assistant is unavailable.';
  await runAgent({
    ...input,
    emit: (e) => {
      if (e.type === 'done') done = e.data;
      if (e.type === 'error') failure = e.error;
    },
  });
  if (!done) throw new Error(failure);
  return done;
}
