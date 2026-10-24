import React from 'react';
import Link from 'next/link';

import { EntityProfile } from '@/components/portal/EntityProfile';
import { resolveEntity } from '@/lib/entities/registry';
import { sourceLabel, stubRelations } from '@/lib/entities/sources/company-stubs';
import type { Entity } from '@/lib/entities/types';
import { quoteExcerpt } from '@/lib/chat-tools/graph-rows';
import { graphNode, relationEvidence, type Relation } from '@/lib/graph/index';
import { correctionUrl } from '@/lib/site';
import { t } from '@/lib/i18n/messages';
import { countryHref, countryNameOf } from '@/lib/world/pages';

/** Where a reader can open the other end: its page, else the country whose table printed it. */
function otherEnd(id: string): { name: string; href?: string } {
  const node = graphNode(id);
  const page = resolveEntity(id)?.href ?? (node.iso2[0] ? countryHref(node.iso2[0]) : undefined);
  return { name: node.name, ...(page ? { href: page } : {}) };
}

function Row({ r, self }: { r: Relation; self: string }) {
  const ev = relationEvidence(r);
  const other = otherEnd(r.from === self ? r.to : r.from);
  const source = r.evidence[0];
  const quote = quoteExcerpt(source.quote, [graphNode(r.from).name, graphNode(r.to).name]);
  return (
    <li className="py-4">
      <p className="text-sm leading-relaxed text-fg-primary">{ev.sentence}</p>
      <p className="mt-1 text-xs text-fg-tertiary">
        {ev.gradeLabel} · as of {r.asOf}
        {other.href && (
          <>
            {' · '}
            <Link
              href={other.href}
              className="tap text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
            >
              {other.name}
            </Link>
          </>
        )}
      </p>
      <blockquote className="mt-2 max-w-prose border-l border-subtle pl-3 text-sm leading-relaxed text-fg-secondary wrap-anywhere">
        {quote.whole ? '' : '… '}
        {quote.text}
        {quote.whole ? '' : ' …'}
      </blockquote>
      <p className="mt-1 text-xs text-fg-muted wrap-anywhere">
        <a
          href={source.source}
          rel="noreferrer"
          className="tap text-accent underline-offset-4 hover:underline"
        >
          {sourceLabel(source.source)} ↗
        </a>
        {source.locator ? ` · ${source.locator}` : ''} · {ev.sources[0]?.reading}
      </p>
    </li>
  );
}

/**
 * A company the relation graph names and the directory holds no profile for
 * (lib/entities/sources/company-stubs.ts). Same route, same profile frame as
 * a profiled company; the only section of its own is what the sources say,
 * each row with its grade, its quote and its source.
 */
export function StubCompany({ entity }: { entity: Entity }) {
  const relations = stubRelations(entity.id);
  const countries = graphNode(entity.id).iso2;
  return (
    <>
      <header className="mb-4 border-b border-subtle pb-8">
        <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          Named in sources
          {countries.length > 0 && ' · '}
          {countries.map((iso2, i) => (
            <React.Fragment key={iso2}>
              {i > 0 && ', '}
              <Link href={countryHref(iso2)} className="tap hover:text-fg-primary hover:underline">
                {countryNameOf(iso2)}
              </Link>
            </React.Fragment>
          ))}
        </p>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary wrap-anywhere sm:text-4xl">
          {entity.name}
        </h1>
        {entity.aka.length > 0 && (
          <p className="mt-2 text-sm text-fg-tertiary">Also printed as {entity.aka.join(', ')}</p>
        )}
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-fg-secondary">
          We hold no profile for this company yet: this page lists only what published sources say
          about it. {countries.length === 0 && 'No source states its country.'}
        </p>
        <p className="mt-3 text-sm">
          <a
            href={correctionUrl(entity.name, {
              problem: 'Evidence about a company the site holds no profile for.',
            })}
            className="tap inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline"
          >
            Send evidence about it on GitHub
          </a>
        </p>
      </header>

      <EntityProfile
        entity={entity}
        extra={[
          {
            id: 'sources-say',
            title: t('profile.stubSources.title'),
            importance: 10,
            evidence: `${relations.length} ${relations.length === 1 ? 'relation' : 'relations'}, each quoted`,
            node: (
              <ul className="divide-y divide-subtle border-y border-subtle">
                {relations.map((r) => (
                  <Row key={r.id} r={r} self={entity.id} />
                ))}
              </ul>
            ),
          },
        ]}
      />
    </>
  );
}
