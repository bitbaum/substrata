/**
 * The X-ray as CSV, built in the reader's browser from the response it
 * already holds, so the export never makes a second trip with the holdings.
 *
 * Pure and corpus-free on purpose: it imports types only, so it can ship to
 * the client without dragging the research files along.
 */
import type { PortfolioXray } from './portfolio';

export const XRAY_CSV_HEADER = [
  'input',
  'security',
  'weight_share',
  'company',
  'bottleneck',
  'relation',
  'role_or_route',
  'evidence_urls',
  'binding_out_of_12',
  'horizon',
  'net_pressure',
] as const;

function cell(v: string | number): string {
  const text = String(v);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function xrayCsv(x: PortfolioXray): string {
  const rails = new Map(x.rails.map((r) => [r.bottleneck, r]));
  const rows: (string | number)[][] = [];
  for (const h of x.holdings) {
    const weight = h.weight === null ? '' : h.weight.toFixed(4);
    const base = (bottleneck: string) => {
      const r = rails.get(bottleneck);
      return [r?.binding ?? '', r?.horizon ?? '', r?.netPressure ?? ''];
    };
    for (const r of h.held)
      rows.push([
        h.input,
        h.security.label,
        weight,
        r.company,
        r.bottleneck,
        r.supplier ? 'part' : 'holds',
        r.role,
        r.evidence ?? '',
        ...base(r.bottleneck),
      ]);
    for (const d of h.depends)
      rows.push([
        h.input,
        h.security.label,
        weight,
        d.company,
        d.bottleneck,
        d.relation,
        [d.start, ...d.path.map((e) => e.on)].join(' > '),
        d.path.map((e) => e.source).join(' '),
        ...base(d.bottleneck),
      ]);
    if (h.held.length + h.depends.length === 0)
      rows.push([
        h.input,
        h.security.label,
        weight,
        h.companies.map((c) => c.name).join('; '),
        '',
        'none recorded',
        '',
        '',
        '',
        '',
        '',
      ]);
  }
  for (const u of x.unresolved)
    rows.push([u.input, '', '', '', '', 'unresolved', u.reason, '', '', '', '']);
  return [XRAY_CSV_HEADER.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n') + '\n';
}
