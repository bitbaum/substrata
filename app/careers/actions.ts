'use server';

/**
 * Following companies and role families for jobs. Re-reads the session: the
 * form is posted by whoever holds the page, and the page is not proof of who
 * that is.
 */
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { updateFollows } from '@/lib/desk-store';
import { toggleJobFollow } from '@/lib/job-follows';

export async function followJobs(form: FormData) {
  const session = await auth();
  if (!session?.actorId) return;
  const kind = form.get('kind') === 'family' ? 'family' : 'company';
  const id = String(form.get('id') ?? '').slice(0, 120);
  const on = form.get('on') === '1';
  // updateFollows parses what it stores, so an unknown company or family is dropped.
  await updateFollows(session.actorId, (current) => ({
    ...current,
    jobs: toggleJobFollow(current.jobs, kind, id, on),
  }));
  revalidatePath('/careers');
}
