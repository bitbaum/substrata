/** The free models this deployment offers, and the gate that honours only those. */
import { freeChain, usableChain } from '@bitbaum/ai-kit';

export function availableModels() {
  const chain = usableChain(freeChain('SUBSTRATA'), process.env);
  return [
    { id: 'auto', label: 'Auto' },
    ...chain.map((link) => ({
      id: link.model,
      label: `${link.provider.id} · ${link.model}`,
    })),
  ];
}

/**
 * Whether a model id is one this deployment actually offers.
 *
 * The caller supplies this string, and ai-kit treats a model it does not find
 * in the chain as an instruction rather than a typo: `chainFrom()` PREPENDS it,
 * so an unrecognised id is the first thing tried, against our key. The free
 * chain is free only because every id in it is; `anthropic/claude-opus-4` sent
 * to the same OpenRouter key is a paid call we would be billed for.
 *
 * So an id is honoured only when it is already in the chain we built.
 */
export function isOfferedModel(model: string): boolean {
  if (model === 'auto') return true;
  return usableChain(freeChain('SUBSTRATA'), process.env).some((link) => link.model === model);
}
