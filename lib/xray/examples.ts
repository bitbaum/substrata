/** Forms the parser reads, shown as examples on /xray and the equities view. */
export const XRAY_FORMS = ['ASML NA', '8035 JP', 'NVDA US', '8035.T', 'NASDAQ:AMD', 'MU 12.5%'];

/** A real mix across the chain: designer, foundry, tools, memory, power. */
export const XRAY_SAMPLE = [
  'NVDA US',
  'TSM US',
  'ASML NA',
  '8035 JP',
  'AMAT US',
  'MU US',
  'GEV US',
].join('\n');

/** The empty box's hint: three forms, not a portfolio (a placeholder that looks filled reads as filled). */
export const XRAY_PLACEHOLDER = ['NVDA US', 'ASML NA 20%', '8035.T'].join('\n');
