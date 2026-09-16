import { xml } from './diagram-xml';

export type DiagramNode = { href: string; label: string; kind: string };

/** Small relationship figure for a country dossier. Not a trade-flow map. */
export function countryDiagram(name: string, nodes: DiagramNode[]): string {
  const items = nodes.slice(0, 8);
  const height = Math.max(220, 90 + items.length * 36);
  const rows = items
    .map((n, i) => {
      const y = 70 + i * 36;
      return `<a href="${xml(n.href)}"><rect x="200" y="${y}" width="360" height="28" fill="#1a1a1a" stroke="#3d3d3d"/><text x="212" y="${y + 19}" font-size="12" fill="#f5f5f5">${xml(n.kind)} · ${xml(n.label.slice(0, 42))}</text></a>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 ${height}" role="img" aria-label="Records connected to ${xml(name)}"><rect width="580" height="${height}" fill="#111"/><text x="16" y="28" font-size="14" fill="#f5f5f5" font-weight="600">${xml(name)}</text><text x="16" y="48" font-size="11" fill="#8a8a8a">Connected records in this corpus</text><rect x="16" y="${Math.max(80, height / 2 - 14)}" width="150" height="28" fill="#111" stroke="#f5f5f5"/><text x="28" y="${Math.max(80, height / 2 - 14) + 19}" font-size="12" fill="#f5f5f5">${xml(name.slice(0, 18))}</text>${items
    .map((_, i) => {
      const y = 84 + i * 36;
      return `<path d="M166 ${Math.max(80, height / 2)} C 180 ${Math.max(80, height / 2)}, 190 ${y}, 200 ${y}" fill="none" stroke="#6b5a3a"/>`;
    })
    .join('')}${rows}</svg>`;
}
