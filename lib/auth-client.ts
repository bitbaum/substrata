'use client';

import { createAuthClient } from 'better-auth/react';
import { authClientPlugins } from '@bitbaum/accountkit/auth/client';

/** The browser half of accounts. Talks only to this origin (/api/auth). */
export const authClient = createAuthClient({ plugins: authClientPlugins() });
