import React from 'react';

import { Heading } from '@/components/portal/Shell';
import { modulesFor } from '@/lib/profile/modules';
import type { Entity } from '@/lib/entities/types';

/**
 * Renders an entity's modules, in importance order.
 *
 * Every kind gets the same treatment from the same registry, which is what
 * makes two profiles comparable and what makes a new section — leadership,
 * stock performance, an analyst view — a one-file change rather than an edit to
 * every page. A module with nothing to say is not rendered, so a thinner entity
 * looks thinner rather than looking broken.
 *
 * `from` lets a page keep its bespoke body above the shared modules while the
 * migration proceeds; those sections become modules one at a time.
 */
/**
 * A section the page supplies itself, because its data is not in the corpus —
 * sweep leads come from the database, per request. It takes its place in the
 * same importance order and numbering as the modules, and a page passes one
 * only when it has something in it.
 */
export interface ExtraSection {
  id: string;
  title: string;
  importance: number;
  node: React.ReactNode;
  evidence?: string;
}

export function EntityProfile({
  entity,
  from,
  extra = [],
}: {
  entity: Entity;
  from?: number;
  extra?: ExtraSection[];
}) {
  // A page section with a module's id REPLACES that module: the company page
  // hands "what has happened" its SEC filings, which the registry, being
  // synchronous and corpus-only, cannot load. Same id, same anchor, one
  // section — never the module and a richer twin of it.
  const replaced = new Set(extra.map((section) => section.id));
  const rendered = [
    ...modulesFor(entity, from)
      .filter((module) => !replaced.has(module.id))
      .map((module) => ({ module, output: module.render(entity) }))
      .filter((entry) => entry.output !== null),
    ...extra.map((section) => ({
      module: { ...section, ownsHeading: false },
      output: { node: section.node, evidence: section.evidence },
    })),
  ].sort((a, b) => a.module.importance - b.module.importance);

  if (rendered.length === 0) return null;

  // Numbering is derived, not written down. Sections used to carry hand-kept
  // `01`, `02` counters, so inserting one in the middle meant renumbering the
  // rest — and a section that rendered conditionally could leave a gap.
  let counter = 0;

  return (
    <>
      {rendered.map(({ module, output }) => {
        const index = module.ownsHeading ? undefined : String(++counter).padStart(2, '0');
        return (
          <section key={module.id} id={module.id} className="mt-12 scroll-mt-24">
            {!module.ownsHeading && (
              <Heading index={index} title={module.title} aside={output?.evidence} />
            )}
            {output?.node}
          </section>
        );
      })}
    </>
  );
}
