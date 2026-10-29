'use server';

import { signOut } from '@/lib/auth';

/**
 * Signing out, as a server action in a file of its own so the account menu
 * can be rendered on the server (a page that knows its reader) or in the
 * browser (a cached page that learns its reader after it loads). Inline
 * `'use server'` closures could only live in a server component. Signing in
 * is a link to /sign-in, which offers every way in.
 */
export async function signOutOfSubstrata() {
  await signOut({ redirectTo: '/' });
}
