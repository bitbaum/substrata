'use server';

import { signIn, signOut } from '@/lib/auth';

/**
 * The two account actions, as server actions in a file of their own so the
 * account menu can be rendered on the server (a page that knows its reader)
 * or in the browser (a cached page that learns its reader after it loads).
 * Inline `'use server'` closures could only live in a server component.
 */
export async function continueWithOrangeCat() {
  await signIn('orangecat', { redirectTo: '/account' });
}

export async function signOutOfSubstrata() {
  await signOut({ redirectTo: '/' });
}
