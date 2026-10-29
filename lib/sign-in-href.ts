import { returnPath } from '@bitbaum/accountkit/orangecat';

/**
 * The sign-in (or sign-up) screen, returning to `from` afterwards. Never an
 * open redirect. Pure, so the browser account menu can build it too.
 */
export function signInHref(from: string, mode: 'sign-in' | 'sign-up' = 'sign-in'): string {
  return `/${mode}?next=${encodeURIComponent(returnPath(from, '/account'))}`;
}
