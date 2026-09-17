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
export function EntityProfile({ entity, from }: { entity: Entity; from?: number }) {
  const rendered = modulesFor(entity, from)
    .map((module) => ({ module, output: module.render(entity) }))
    .filter((entry) => entry.output !== null);

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
