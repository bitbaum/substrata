import { resolveByPath } from './entities/registry';
import { allLearn, allNotes } from './notes';

/** What a fact-check is about: the page's title and its one-line summary. */
export interface FactcheckSubject {
  title: string;
  summary: string;
}

/**
 * The page a fact-check was asked from, or undefined when the path is not one.
 *
 * Every entity profile mounts the discussion — and with it the fact-check
 * button — so the route has to know those pages as well as notes and learn
 * articles. It only knew the two article kinds, and the button on every
 * science, company or bottleneck profile answered 404.
 */
export function factcheckSubject(path: string): FactcheckSubject | undefined {
  const note = path.startsWith('/notes/')
    ? allNotes().find((n) => path === `/notes/${n.slug}`)
    : path.startsWith('/learn/')
      ? allLearn().find((n) => path === `/learn/${n.slug}`)
      : undefined;
  if (note) return { title: note.title, summary: note.summary };
  const entity = path.startsWith('/') ? resolveByPath(path) : undefined;
  return entity ? { title: entity.name, summary: entity.summary } : undefined;
}
