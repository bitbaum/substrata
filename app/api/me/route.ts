import { NextResponse } from 'next/server';

import { currentSession } from '@/lib/auth';
import { readerFrom } from '@/components/portal/AccountMenu';

/**
 * Who is reading, for pages that are served from a cache and so cannot know:
 * the shell asks after it loads and draws the account menu then. Per request,
 * never cached — it answers for one person's cookie.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const reader = readerFrom(await currentSession());
  return NextResponse.json(reader, { headers: { 'Cache-Control': 'private, no-store' } });
}
