import { BOTTLENECKS } from './bottlenecks';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
function colour(name: string) {
  const match = css.match(new RegExp(`--diagram-${name}:\\s*(#[a-fA-F0-9]+)`));
  if (!match) throw new Error(`Missing diagram token ${name}`);
  return match[1];
}
const palette = {
  page: colour('page'),
  card: colour('card'),
  border: colour('border'),
  text: colour('text'),
  muted: colour('muted'),
  source: colour('source'),
  unverified: colour('unverified'),
};

function xml(text: string) {
  return text.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
}
/** Exportable figure from the corpus. Every edge's meaning is declared; no invented trade flows. */
export function chainDiagram(slug: string) {
  const b = BOTTLENECKS.find((b) => b.slug === slug);
  if (!b) return null;
  const producers = b.producers.slice(0, 6);
  const height = Math.max(420, 180 + producers.length * 65);
  const box = (x: number, y: number, width: number, title: string, detail: string) =>
    `<g><rect x="${x}" y="${y}" width="${width}" height="52" rx="8" fill="${palette.card}" stroke="${palette.border}"/><text x="${x + 12}" y="${y + 21}" font-size="13" font-weight="600">${xml(title.slice(0, 38))}${title.length > 38 ? '…' : ''}</text><text x="${x + 12}" y="${y + 40}" font-size="11" fill="${palette.muted}">${xml(detail)}</text></g>`;
  const center = height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${height}" role="img" aria-labelledby="title desc"><title id="title">${xml(b.name)}: mapped producers and technologies</title><desc id="desc">Producer links indicate research coverage, with source status per row. Technology links are analyst classification, not measured supply flows. Complete evidence is on the bottleneck page.</desc><rect width="1000" height="${height}" fill="${palette.page}"/><g font-family="system-ui,sans-serif" fill="${palette.text}"><text x="28" y="36" font-size="20" font-weight="600">${xml(b.name)}</text><text x="28" y="61" font-size="12">Substrata · ${xml(b.judgedOn)} assessment · ${b.producers.length} producer rows · ${b.counts.sourced} sourced</text><text x="28" y="98" font-size="12">PRODUCER COVERAGE</text><text x="400" y="98" font-size="12">BOTTLENECK</text><text x="770" y="98" font-size="12">TECHNOLOGY CLASSIFICATION</text>
 ${producers
   .map((p, i) => {
     const y = 120 + i * 65;
     return `<path d="M 318 ${y + 26} C 355 ${y + 26},355 ${center},390 ${center}" fill="none" stroke="${p.source ? palette.source : palette.unverified}" stroke-width="2" ${p.source ? '' : 'stroke-dasharray="5 4"'}/>${box(28, y, 290, p.name, p.verification)}`;
   })
   .join('')}
 ${box(390, center - 26, 330, b.name, `${b.binding}/12 · analyst judgement`)}
 ${b.technologies
   .map((t, i) => {
     const y = 120 + i * 65;
     return `<path d="M720 ${center} C745 ${center},745 ${y + 26},770 ${y + 26}" fill="none" stroke="${palette.unverified}" stroke-dasharray="3 4"/>${box(770, y, 200, TECHNOLOGIES.find((x) => x.id === t)?.name ?? t, 'Mapped relevance')}`;
   })
   .join('')}
 ${!producers.length ? '<text x="28" y="155" font-size="13">No producer list for this kind of constraint.</text>' : ''}
 <text x="28" y="${height - 34}" font-size="11">${b.producers.length > 6 ? `Showing 6 of ${b.producers.length} producers. ` : ''}Solid: sourced producer row. Dashed: candidate or unverified. Dotted: analyst classification.</text><text x="28" y="${height - 15}" font-size="11">Source: substrata.orangecat.ch/bottlenecks/${xml(b.slug)} · No customer contracts or material quantities are implied.</text></g></svg>`;
}
