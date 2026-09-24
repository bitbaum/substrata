/** Resolving a name a model typed to the corpus record it meant. */
import { BOTTLENECKS, bottleneckByName, bottleneckBySlug, type Bottleneck } from '../bottlenecks';
import { MARKET_PARTICIPANTS, participantBySlug, type MarketParticipant } from '../participants';
import { allEntities, resolveIn } from '../entities/registry';
import type { Entity, EntityKind } from '../entities/types';
import { slugify } from '../links';

// ---------------------------------------------------------------------------
// Resolution — tolerant, because a model types "EUV scanners" and "asml".
// ---------------------------------------------------------------------------

export function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function findBottleneck(nameOrSlug: string): Bottleneck | undefined {
  const raw = nameOrSlug.trim();
  if (!raw) return undefined;
  const direct =
    bottleneckBySlug(raw) ??
    bottleneckBySlug(slugify(raw)) ??
    bottleneckByName(raw) ??
    BOTTLENECKS.find((b) => norm(b.name) === norm(raw));
  if (direct) return direct;
  const wanted = norm(raw);
  // Containment either way, shortest name first so "silicon" does not pick a
  // longer compound over the plain row.
  return [...BOTTLENECKS]
    .sort((a, b) => a.name.length - b.name.length)
    .find((b) => norm(b.name).includes(wanted) || wanted.includes(norm(b.name)));
}

export function findCompany(nameOrSlug: string): MarketParticipant | undefined {
  const raw = nameOrSlug.trim();
  if (!raw) return undefined;
  const bySlug = participantBySlug(raw) ?? participantBySlug(slugify(raw));
  if (bySlug) return bySlug;
  const entity = resolveIn('company', raw);
  if (entity) return participantBySlug(entity.key);
  const wanted = norm(raw);
  return (
    MARKET_PARTICIPANTS.find((p) => norm(p.name) === wanted) ??
    MARKET_PARTICIPANTS.find((p) => norm(p.name).startsWith(wanted)) ??
    MARKET_PARTICIPANTS.find((p) => wanted.length > 3 && norm(p.name).includes(wanted))
  );
}

export function findEntity(name: string, kind?: EntityKind): Entity | undefined {
  const pool = kind ? allEntities().filter((e) => e.kind === kind) : allEntities();
  const wanted = norm(name);
  if (!wanted) return undefined;
  if (kind) {
    const exact = resolveIn(kind, name);
    if (exact) return exact;
  }
  return (
    pool.find((e) => e.key === name || norm(e.name) === wanted) ??
    pool.find((e) => e.aka.some((a) => norm(a) === wanted)) ??
    pool.find(
      (e) => norm(e.name).includes(wanted) || (wanted.length > 4 && wanted.includes(norm(e.name))),
    )
  );
}
