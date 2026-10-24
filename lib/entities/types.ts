/**
 * One shape for everything the corpus can talk about.
 *
 * Before this, an "entity" was whatever each config file happened to call it:
 * bottlenecks were name strings with no id, organisations were matched three
 * different ways (exact name in coverage, exact name for events, slug for
 * proponents), and jurisdictions existed twice in unrelated vocabularies. A
 * rename meant editing about twelve places, and a new kind of thing — a party,
 * a lab, a person in public office — would have added a thirteenth.
 *
 * The facts still live in `config/`. This layer owns only IDENTITY: what a
 * thing is, what it is called, where it lives, and how well it is evidenced.
 * Everything that needs to point at something points at an `EntityId`.
 */

/** The closed set. Adding a kind is a deliberate edit here, not an accident. */
export const ENTITY_KINDS = [
  'bottleneck',
  'company',
  'science',
  'policy',
  'country',
  'capital',
  'loop',
  'facility',
  'talent',
  'learn',
  'article',
  'lab',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

/**
 * How well a claim is stood up. This is the corpus's existing three-valued
 * ladder, and it is deliberately carried on EVERY entity: a kind that cannot
 * say how it is evidenced has no business being rendered next to one that can.
 */
export type Evidence = string;

/** `company:posco` — kind-scoped so ids cannot collide across kinds. */
export type EntityId = `${EntityKind}:${string}`;

export interface Entity {
  /** Globally unique, kind-scoped. The only join key anything should use. */
  id: EntityId;
  kind: EntityKind;
  /** The id within its kind (`posco`), which is what routes are built from. */
  key: string;
  name: string;
  /** Other spellings. Joins go through here so case and punctuation cannot split a firm in two. */
  aka: string[];
  href: string;
  /** One plain sentence. No jargon, no acronym without expansion. */
  summary: string;
  /** How this row is evidenced, in the corpus's own vocabulary. */
  evidence: Evidence;
  /** Primary sources for the claims on this entity. May be empty; never invented. */
  sources: string[];
  topics: string[];
  /**
   * The long projection used for search ranking and AI retrieval, carrying the
   * caveats each kind needs. Kept next to identity so search, the assistant and
   * the profile can never disagree about what an entity is.
   */
  retrievalText: string;
}

/**
 * The evidence word a stub carries: an organisation the relation graph names
 * (an operator or owner a published table printed) that the directory holds no
 * profile for. Its page lists only what the sources say; search ranks it below
 * a profiled entity; nothing is written about it beyond the relations.
 */
export const STUB_EVIDENCE = 'stub';

export function isStub(entity: Pick<Entity, 'evidence'>): boolean {
  return entity.evidence === STUB_EVIDENCE;
}

export function entityId(kind: EntityKind, key: string): EntityId {
  return `${kind}:${key}`;
}
