'use client';

import { AccountMenuView } from '@/components/portal/AccountMenuView';
import { useReader } from './useReader';

/**
 * The account menu for a cached page. Until /api/me answers it holds the
 * menu's place (same size as "Sign in") instead of guessing, so a signed-in
 * reader never sees "Sign in" flash and nothing moves when it arrives.
 */
export function ClientAccountMenu() {
  const reader = useReader(true);
  if (!reader) return <span className="account-menu-pending" aria-hidden />;
  return <AccountMenuView reader={reader} />;
}
