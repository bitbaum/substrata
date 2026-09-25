/** How resource figures are printed: USGS precision for tables, readable precision for EIA's decimals. */

export function formatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100) return Math.round(value).toLocaleString('en');
  if (abs >= 10) return value.toLocaleString('en', { maximumFractionDigits: 1 });
  return value.toLocaleString('en', { maximumFractionDigits: 2 });
}

/** A share as a percentage: one decimal under 10%, none above; "<0.1%" rather than a misleading zero. */
export function formatShare(share: number): string {
  const pct = share * 100;
  // A country against a rounded world total can reach or pass 100%.
  if (pct >= 99.5) return '~100%';
  if (pct > 0 && pct < 0.1) return '<0.1%';
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${suffix}`;
}

export function formatChange(change: number): string {
  const pct = Math.round(change * 100);
  return `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${Math.abs(pct)}%`;
}

export function formatYears(years: number): string {
  return years >= 1000 ? 'over 1,000 years' : `${Math.round(years).toLocaleString('en')} years`;
}
