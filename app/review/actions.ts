'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { CoverageEvent, EventEffect, EventKind } from '@/config/substrata-events';
import { auth, isReviewer } from '@/lib/auth';
import { acceptDraft } from '@/lib/event-draft-store';
import { eventIdFor } from '@/lib/event-rules';
import { recordVerdict } from '@/lib/sweep-review';

async function reviewerId(): Promise<string> {
  const session = await auth();
  if (!isReviewer(session?.actorId)) throw new Error('Not a reviewer');
  return session!.actorId!;
}

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};
/** One name per line — names contain commas ("Silicon carbide substrate, 200 mm …"). */
const lines = (form: FormData, name: string) =>
  text(form, name)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

/** The edited draft as a full event row. Validation is `acceptDraft`'s, not this parser's. */
function eventFrom(form: FormData, today: string): CoverageEvent {
  const date = text(form, 'date');
  const headline = text(form, 'headline');
  return {
    id: eventIdFor(date, headline),
    date,
    headline,
    kind: text(form, 'kind') as EventKind,
    effect: text(form, 'effect') as EventEffect,
    bottlenecks: lines(form, 'bottlenecks'),
    participants: lines(form, 'participants'),
    jurisdictions: text(form, 'jurisdictions')
      .split(/[\s,]+/)
      .map((s) => s.toUpperCase())
      .filter(Boolean),
    source: text(form, 'source'),
    primary: form.get('primary') === 'on',
    quote: text(form, 'quote'),
    acceptedOn: today,
  };
}

/**
 * Accept a lead as the event its (edited) draft describes.
 *
 * On a problem the reviewer lands back on the same lead with the reasons,
 * and nothing is written. On success the row waits for
 * `pnpm run research:accept-events`; it is not published by this.
 */
export async function acceptLead(form: FormData) {
  const actorId = await reviewerId();
  const id = text(form, 'id');
  if (!id) throw new Error('No lead named');
  const problems = await acceptDraft(
    id,
    eventFrom(form, new Date().toISOString().slice(0, 10)),
    actorId,
  );
  revalidatePath('/review');
  if (problems.length) {
    redirect(
      `/review?lead=${encodeURIComponent(id)}&problem=${encodeURIComponent(problems.join(' '))}#lead-${id}`,
    );
  }
  redirect(`/review?accepted=${encodeURIComponent(id)}`);
}

/** Not an event: out of the queue for good, and never resurrected by a re-sweep. */
export async function rejectLead(form: FormData) {
  const actorId = await reviewerId();
  const id = text(form, 'id');
  if (!id) throw new Error('No lead named');
  await recordVerdict(id, 'rejected', actorId);
  revalidatePath('/review');
}
