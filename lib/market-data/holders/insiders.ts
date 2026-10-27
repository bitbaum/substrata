/**
 * Forms 3 and 4: what a director, an officer or a 10% owner reports holding
 * after each trade, in XML on EDGAR. One form lists one or more ownership
 * LINES (held directly; "By Trust"; "By Profit Sharing Plan Trust"), each with
 * the shares held after the last transaction on that line.
 *
 * What is computed: the lines a form REPORTS, summed. A form is not obliged
 * to list a line that did not trade, so the sum is "at least" — said so with
 * every figure (`lowerBound: true`), never presented as the person's whole
 * holding. The proxy table's "as a group" row is the complete figure, dated
 * to its record date; these are the recent trades after it.
 */

export interface InsiderFiling {
  owner: string;
  /** "Director", "EVP and CFO", "10% owner". */
  role: string;
  /** The form's period of report, YYYY-MM-DD. */
  date: string;
  /** Common shares on the lines this form reports, summed. */
  sharesReported: number;
  lines: { nature: string; shares: number }[];
  lowerBound: true;
}

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(
    new RegExp(`<${name}>\\s*(?:<value>)?([\\s\\S]*?)(?:</value>)?\\s*</${name}>`),
  );
  return m ? m[1].trim() : null;
};

/** "COXE TENCH" → "Tench Coxe": EDGAR files names surname first, in capitals. */
export function ownerName(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 2 || raw !== raw.toUpperCase()) return raw.trim();
  const cap = (w: string) => w.toLowerCase().replace(/(^|[-'])\p{L}/gu, (c) => c.toUpperCase());
  return [...parts.slice(1), parts[0]].map(cap).join(' ');
}

export function parseForm4(xml: string): InsiderFiling | null {
  const owner = tag(xml, 'rptOwnerName');
  const date = tag(xml, 'periodOfReport');
  if (!owner || !date) return null;
  const roles = [
    tag(xml, 'isDirector') === '1' || tag(xml, 'isDirector') === 'true' ? 'Director' : null,
    tag(xml, 'isOfficer') === '1' || tag(xml, 'isOfficer') === 'true'
      ? (tag(xml, 'officerTitle') ?? 'Officer')
      : null,
    tag(xml, 'isTenPercentOwner') === '1' || tag(xml, 'isTenPercentOwner') === 'true'
      ? '10% owner'
      : null,
  ].filter(Boolean);
  const table = xml.match(/<nonDerivativeTable>([\s\S]*?)<\/nonDerivativeTable>/)?.[1] ?? '';
  // The last figure per line wins: rows are in the order they happened.
  const byLine = new Map<string, number>();
  for (const row of table.matchAll(
    /<nonDerivative(?:Transaction|Holding)>([\s\S]*?)<\/nonDerivative(?:Transaction|Holding)>/g,
  )) {
    const shares = Number(tag(row[1], 'sharesOwnedFollowingTransaction'));
    if (!Number.isFinite(shares)) continue;
    const direct = tag(row[1], 'directOrIndirectOwnership');
    const nature = direct === 'D' ? 'Direct' : (tag(row[1], 'natureOfOwnership') ?? 'Indirect');
    byLine.set(`${tag(row[1], 'securityTitle') ?? ''}|${nature}`, shares);
  }
  const lines = [...byLine].map(([k, shares]) => ({ nature: k.split('|')[1], shares }));
  return {
    owner: ownerName(owner),
    role: roles.join(', ') || 'Reporting person',
    date,
    sharesReported: lines.reduce((s, l) => s + l.shares, 0),
    lines,
    lowerBound: true,
  };
}
