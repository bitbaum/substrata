/**
 * "Update news now": what a page's update covers, and the leads it shows.
 *
 * Step one is the web sweep, which calls no model and is open to everyone,
 * signed out included (rate-limited per visitor). Step two, "Summarise with
 * AI", drafts those leads on the READER's own key — see
 * app/api/updates/draft/route.ts. The site's free AI is kept for questions.
 */
import { BOTTLENECKS, bottleneckBySlug } from './bottlenecks';
import { companyProfile } from './company-profile';
import { database } from './db';
import { readFollows } from './desk-store';
import { railsOf } from './follows';
import type { UpdateLead, UpdateScope } from './update-shared';

export { SUMMARISE_AT_ONCE } from './update-shared';

/** Leads an update shows, newest first. */
export const UPDATE_LEADS_SHOWN = 8;
/** Updates one visitor may start per hour. The sweep is free to us only in money. */
export const UPDATES_PER_HOUR = 10;
/** Summaries one visitor may start per hour — each reads pages on our side. */
export const SUMMARIES_PER_HOUR = 20;

export function parseScope(raw: unknown): UpdateScope | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const slug = typeof o.slug === 'string' && /^[a-z0-9-]{1,80}$/.test(o.slug) ? o.slug : null;
  if (o.kind === 'desk') return { kind: 'desk' };
  if ((o.kind === 'bottleneck' || o.kind === 'company') && slug) return { kind: o.kind, slug };
  return null;
}

/** The bottleneck names a scope covers; null when it names nothing (or the desk has no reader). */
export async function scopeNames(
  scope: UpdateScope,
  actorId: string | null,
): Promise<string[] | null> {
  if (scope.kind === 'bottleneck') {
    const b = bottleneckBySlug(scope.slug);
    return b ? [b.name] : null;
  }
  if (scope.kind === 'company') {
    const profile = companyProfile(scope.slug);
    return profile ? profile.held.map((h) => h.bottleneck.name) : null;
  }
  if (!actorId) return null;
  return railsOf(await readFollows(actorId)).map((b) => b.name);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Unreviewed leads on these bottlenecks (or with these ids), with whatever draft each has. */
export async function openLeads(
  {
    names = null,
    ids = null,
  }: { names?: readonly string[] | null; ids?: readonly string[] | null },
  limit = UPDATE_LEADS_SHOWN,
): Promise<UpdateLead[]> {
  if (names?.length === 0 || ids?.length === 0) return [];
  const { rows } = await database().query<{
    id: string;
    title: string;
    url: string;
    bottleneck: string;
    found_at: Date;
    status: NonNullable<UpdateLead['draft']>['status'] | null;
    suggestion: 'event' | 'not_an_event' | null;
    headline: string | null;
    date: string | null;
    reason: string | null;
  }>(
    `SELECT c.id, c.title, c.url, c.bottleneck, c.found_at,
            d.status, d.suggestion, d.reason,
            d.draft->>'headline' AS headline, d.draft->>'date' AS date
       FROM research_sweep_candidates c
       LEFT JOIN research_event_drafts d ON d.candidate_id = c.id
      WHERE c.reviewed_at IS NULL
        AND c.verdict IS DISTINCT FROM 'rejected'
        AND ($1::text[] IS NULL OR c.bottleneck = ANY($1::text[]))
        AND ($3::text[] IS NULL OR c.id = ANY($3::text[]))
      ORDER BY c.found_at DESC
      LIMIT $2`,
    [names, limit, ids],
  );
  const slugOf = new Map(BOTTLENECKS.map((b) => [b.name, b.slug]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    host: hostOf(r.url),
    bottleneck: r.bottleneck,
    bottleneckSlug: slugOf.get(r.bottleneck) ?? null,
    foundAt: r.found_at.toISOString(),
    draft: r.status
      ? {
          status: r.status,
          suggestion: r.suggestion,
          headline: r.headline,
          date: r.date,
          reason: r.reason ?? '',
        }
      : null,
  }));
}
