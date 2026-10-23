/** Display words for the ownership vocabularies (config/substrata-ownership.ts), so no page prints a raw enum. */
import type { HolderKind, OwnershipStatus } from './substrata-ownership';

export const HOLDER_KIND_LABEL: Record<HolderKind, string> = {
  founder: 'Founder or family',
  state: 'State',
  fund: 'Fund',
  strategic: 'Strategic',
  'public-float': 'Public float',
};

export const OWNERSHIP_STATUS_LABEL: Record<OwnershipStatus, string> = {
  listed: 'Listed',
  private: 'Private',
  subsidiary: 'Subsidiary',
  'state-owned': 'State-owned',
};
