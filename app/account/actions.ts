'use server';

/**
 * Everything the desk can change, as server actions.
 *
 * Each one re-reads the session: a form is posted by whoever holds the page,
 * and the page is not proof of who that is. Inputs are parsed through the same
 * functions the reads use, so a hand-crafted post lands on a default rather
 * than in the database.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { auth, isReviewer } from '@/lib/auth';
import { setMark, clearMarks, readFollows, updateFollows } from '@/lib/desk-store';
import { normaliseHost, railsOf, parseDesk, type Follows } from '@/lib/follows';
import { type MarkState } from '@/lib/desk-filter';
import { parseSweepSettings } from '@/lib/sweep';
import { CHECK_NOW_COOLDOWN_HOURS, saveSweepSettings, sweepStaleNow } from '@/lib/sweep-store';
import { recordVerdict } from '@/lib/sweep-review';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';

async function actor(): Promise<string> {
  const session = await auth();
  if (!session?.actorId) throw new Error('Sign in first');
  return session.actorId;
}

const STATES: MarkState[] = ['read', 'saved', 'hidden'];

export async function toggleMark(form: FormData) {
  const actorId = await actor();
  const key = String(form.get('key') ?? '');
  const state = String(form.get('state') ?? '') as MarkState;
  if (!/^(event|lead|filing|science):[\w.-]{1,120}$/.test(key) || !STATES.includes(state)) return;
  await setMark(actorId, key, state, form.get('on') === '1');
  revalidatePath('/account');
}

export async function muteHost(form: FormData) {
  const actorId = await actor();
  const host = normaliseHost(String(form.get('host') ?? ''));
  if (!host) return;
  await updateFollows(actorId, (f) => ({
    ...f,
    desk: { ...f.desk, mutedHosts: [...f.desk.mutedHosts, host] },
  }));
  revalidatePath('/account');
}

export async function markAllRead() {
  const actorId = await actor();
  await updateFollows(actorId, (f) => ({
    ...f,
    desk: { ...f.desk, readUntil: new Date().toISOString() },
  }));
  // Per-row read marks are now redundant with the watermark.
  await clearMarks(actorId, 'read');
  revalidatePath('/account');
}

export async function verdict(form: FormData) {
  const actorId = await actor();
  if (!isReviewer(actorId)) return;
  const id = String(form.get('id') ?? '');
  const value = form.get('verdict');
  if (!/^[0-9a-f]{12}$/.test(id) || (value !== 'accepted' && value !== 'rejected')) return;
  await recordVerdict(id, value, actorId);
  revalidatePath('/account');
}

export async function checkNow() {
  const actorId = await actor();
  const rails = railsOf(await readFollows(actorId)).map((b) => b.name);
  const outcome = await sweepStaleNow(rails, { cooldownHours: CHECK_NOW_COOLDOWN_HOURS });
  redirect(
    `/account?checked=${outcome.swept.length}&found=${outcome.found}&blind=${outcome.couldNotLook}`,
  );
}

/** Sweep one named rail now, from the settings table. Ten-minute cooldown per node. */
export async function sweepOne(form: FormData) {
  await actor();
  const name = String(form.get('name') ?? '');
  if (!BOTTLENECKS.some((b) => b.name === name)) return;
  await sweepStaleNow([name], { cooldownHours: 1 / 6, limit: 1 });
  revalidatePath('/account/settings');
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function saveSettings(form: FormData) {
  const actorId = await actor();
  const technologies = form
    .getAll('topics')
    .map(String)
    .filter((id) => TECHNOLOGIES.some((t) => t.id === id));
  const rail = (slug: string) => String(form.get(`rail:${slug}`) ?? 'auto');
  const bottlenecks = BOTTLENECKS.filter((b) => rail(b.slug) === 'follow').map((b) => b.slug);
  const muted = BOTTLENECKS.filter((b) => rail(b.slug) === 'mute').map((b) => b.slug);
  await updateFollows(actorId, (current): Follows => {
    const desk = parseDesk({
      ...current.desk,
      showVerified: form.get('showVerified') === 'on',
      showLeads: form.get('showLeads') === 'on',
      showFilings: form.get('showFilings') === 'on',
      showScience: form.get('showScience') === 'on',
      strictLeads: form.get('strictLeads') === 'on',
      window: form.get('window'),
      grouping: form.get('grouping'),
      leadMaxAgeDays: form.get('leadMaxAgeDays'),
      mutedHosts: lines(form.get('mutedHosts'))
        .map(normaliseHost)
        .filter((h): h is string => h !== null),
      mutedWords: lines(form.get('mutedWords')),
      sweepOnOpen: form.get('sweepOnOpen') === 'on',
      staleAfterHours: form.get('staleAfterHours'),
      pageSize: form.get('pageSize'),
    });
    return {
      ...current,
      technologies: technologies as Follows['technologies'],
      bottlenecks,
      muted,
      kind: form.get('kind') === 'organization' ? 'organization' : 'individual',
      desk,
    };
  });
  redirect('/account/settings?saved=1');
}

export async function saveSweep(form: FormData) {
  const actorId = await actor();
  if (!isReviewer(actorId)) return;
  const words = lines(form.get('eventWords'));
  await saveSweepSettings(
    parseSweepSettings({
      everyHours: form.get('everyHours'),
      nodesPerRun: form.get('nodesPerRun'),
      pagesPerNode: form.get('pagesPerNode'),
      blockedHosts: lines(form.get('blockedHosts'))
        .map(normaliseHost)
        .filter((h): h is string => h !== null),
      eventWords: words,
    }),
    actorId,
  );
  redirect('/account/settings?saved=sweep#sweep');
}
