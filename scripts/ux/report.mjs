/**
 * Markdown for one run, and for a before/after pair.
 *
 *   node scripts/ux/report.mjs reports/before.json reports/after.json > reports/compare.md
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cell = (r) =>
  r
    ? `${r.pass ? 'pass' : 'FAIL'} · ${r.steps} steps${r.seconds !== null ? ` · ${r.seconds}s` : ''}`
    : '—';

export function markdown(report) {
  const lines = [
    `# UX task flows — ${report.label}`,
    '',
    `${report.base} · ${report.at}`,
    '',
    'Steps = clicks, keystrokes into a field, choices, ticks, and screens of scrolling to reach',
    'what you act on or read. Budgets are per task; a task passes only inside both.',
    '',
    '| Task | Audience | Budget | 390 | 1440 |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const t of report.tasks) {
    const [phone, desk] = [390, 1440].map((w) => t.runs.find((r) => r.viewport === w));
    lines.push(
      `| **${t.id}** — ${t.task} | ${t.audience} | ≤${t.maxSteps} steps, ≤${t.maxSeconds}s | ${cell(phone)} | ${cell(desk)} |`,
    );
  }
  lines.push('', '## Why a task failed', '');
  for (const t of report.tasks)
    for (const r of t.runs)
      if (!r.pass) lines.push(`- ${t.id} @${r.viewport}: ${r.why ?? 'not answered'}`);
  lines.push('', '## Success criteria', '');
  for (const t of report.tasks) lines.push(`- **${t.id}**: ${t.success}`);
  lines.push('', '## Dead ends (every empty or error state must offer the next action)', '');
  lines.push('| State | 390 | 1440 |', '| --- | --- | --- |');
  for (const d of report.deadEnds) {
    const [phone, desk] = [390, 1440].map((w) => d.runs.find((r) => r.viewport === w));
    const show = (r) =>
      !r
        ? '—'
        : !r.found
          ? 'no message found'
          : r.pass
            ? `ok (${r.actions.join(', ')})`
            : 'DEAD END';
    lines.push(`| \`${d.path}\` | ${show(phone)} | ${show(desk)} |`);
  }
  lines.push('', '## Step logs', '');
  for (const t of report.tasks)
    for (const r of t.runs) lines.push(`- ${t.id} @${r.viewport}: ${r.log.join(' → ') || '—'}`);
  return `${lines.join('\n')}\n`;
}

export function compare(before, after) {
  const lines = [
    `# UX task flows — ${before.label} vs ${after.label}`,
    '',
    `${before.base} (${before.at.slice(0, 16)}) → ${after.base} (${after.at.slice(0, 16)})`,
    '',
    '| Task | Budget | 390 before | 390 after | 1440 before | 1440 after |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const t of after.tasks) {
    const b = before.tasks.find((x) => x.id === t.id);
    const at = (set, w) => set?.runs.find((r) => r.viewport === w);
    lines.push(
      `| ${t.id} | ≤${t.maxSteps} steps, ≤${t.maxSeconds}s | ${cell(at(b, 390))} | ${cell(at(t, 390))} | ${cell(at(b, 1440))} | ${cell(at(t, 1440))} |`,
    );
  }
  const passes = (r) => r.tasks.flatMap((t) => t.runs).filter((x) => x.pass).length;
  const total = (r) => r.tasks.flatMap((t) => t.runs).length;
  const open = (r) => r.deadEnds.flatMap((d) => d.runs).filter((x) => !x.pass).length;
  lines.push(
    '',
    `Task runs passing: ${passes(before)}/${total(before)} → ${passes(after)}/${total(after)}.`,
    `Dead ends: ${open(before)} → ${open(after)}.`,
  );
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [a, b] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, 'utf8')));
  process.stdout.write(b ? compare(a, b) : markdown(a));
}
