/**
 * Ask the live site the research-mode questions and keep what came back.
 *
 *   pnpm exec tsx scripts/ux/ask-live.ts                         # production, the five questions
 *   pnpm exec tsx scripts/ux/ask-live.ts --base http://localhost:3000
 *   pnpm exec tsx scripts/ux/ask-live.ts --only neon             # questions containing "neon"
 *
 * Posts each question to /api/chat exactly as the Ask panel does (same
 * origin, the free model chain, the reader's hourly and daily limits apply:
 * five questions spend five of them), reads the event stream, and writes
 * scripts/ux/reports/ask-live-<date>.md with, per question: the steps the
 * reader saw (Planning…, Searching: …, Reading …, Writing…), seconds to the
 * first word and to the end, model calls, the answer as the reader got it,
 * and every web page read with its date. Nothing is graded here: read it.
 *
 * See docs/architecture/2026-10-25-research-mode.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const RESEARCH_QUESTIONS = [
  'What do you think will be the demand for neon in the future? Give sources.',
  'What is the demand outlook for helium over the next decade?',
  'When could small modular reactors be commercial?',
  'What happens to chip supply if Ukraine neon is cut again?',
  'Compare gallium and germanium export controls impact',
];

interface Event {
  type: string;
  text?: string;
  label?: string;
  error?: string;
  data?: {
    answer: string;
    web?: { title: string; url: string; published?: string }[];
    timing?: { firstText?: number; total: number; calls?: number };
  };
}

async function ask(base: string, question: string): Promise<string> {
  const started = Date.now();
  const res = await fetch(new URL('/api/chat', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(base).origin },
    body: JSON.stringify({ question, onPath: '/chat', model: 'auto', history: [] }),
  });
  if (!res.ok || !res.body) return `**HTTP ${res.status}**: ${await res.text()}`;
  const steps: string[] = [];
  let firstWord: number | undefined;
  let done: Event['data'];
  let error = '';
  let buffer = '';
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk as Uint8Array, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines.filter(Boolean)) {
      const e = JSON.parse(line) as Event;
      if (e.type === 'status' && e.text) steps.push(`status: ${e.text}`);
      if (e.type === 'tool' && e.label) steps.push(e.label);
      if (e.type === 'delta' && firstWord === undefined) firstWord = Date.now() - started;
      if (e.type === 'done') done = e.data;
      if (e.type === 'error') error = e.error ?? 'error';
    }
  }
  const secs = (ms?: number) => (ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`);
  return [
    `First word ${secs(firstWord)} · done ${secs(Date.now() - started)} · model calls ${done?.timing?.calls ?? '—'}`,
    '',
    '<details><summary>Steps</summary>',
    '',
    ...steps.map((s) => `- ${s}`),
    '',
    '</details>',
    '',
    error ? `**Error:** ${error}` : (done?.answer ?? '**No answer.**'),
    '',
    '**Web pages read**',
    '',
    ...(done?.web ?? []).map(
      (w, i) => `${i + 1}. [W${i + 1}] [${w.title}](${w.url}) — ${w.published ?? 'undated'}`,
    ),
  ].join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: 'https://substrata.orangecat.ch' },
      only: { type: 'string' },
    },
  });
  const base = values.base!;
  const questions = RESEARCH_QUESTIONS.filter(
    (q) => !values.only || q.toLowerCase().includes(values.only.toLowerCase()),
  );
  const sections: string[] = [];
  for (const q of questions) {
    process.stdout.write(`Asking: ${q}\n`);
    const out = await ask(base, q).catch((e: unknown) => `**Failed:** ${String(e)}`);
    sections.push(`## ${q}\n\n${out}`);
  }
  const date = new Date().toISOString().slice(0, 10);
  const here = dirname(fileURLToPath(import.meta.url));
  const file = join(here, 'reports', `ask-live-${date}.md`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `# Ask, research mode, live — ${base}, ${date}\n\n${sections.join('\n\n')}\n`,
  );
  process.stdout.write(`Wrote ${file}\n`);
}

void main();
