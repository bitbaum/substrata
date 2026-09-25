import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Empty, Heading, Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { Ticker } from '@/components/exposure/Ticker';
import { ItemList } from '@/components/science/ItemList';
import { companiesIn } from '@/components/science/CompaniesActive';
import { matchDirectory } from '@/lib/science-pipeline';
import { itemsByOrg, orgActivity, type OrgActivity, type StoredItem } from '@/lib/science-read';
import { marketHref, pipelineHref, pipelineOrgHref } from '@/lib/links';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Who is doing the science',
  description:
    'Universities, national labs, startups and incumbents named on the research and grants behind each bottleneck, and which listed companies are among them.',
};

/** OpenAlex institution types that are research bodies rather than firms. */
const ACADEMIC = new Set(['education', 'facility', 'government', 'healthcare', 'archive']);

interface Institution {
  name: string;
  type: string | null;
  country: string | null;
  items: number;
  bottlenecks: string[];
}

function byInstitution(orgs: readonly OrgActivity[]): Institution[] {
  const by = new Map<string, Institution>();
  for (const o of orgs) {
    const seen = by.get(o.name) ?? {
      name: o.name,
      type: o.type,
      country: o.country,
      items: 0,
      bottlenecks: [],
    };
    seen.items += o.items;
    if (!seen.bottlenecks.includes(o.bottleneck)) seen.bottlenecks.push(o.bottleneck);
    by.set(o.name, seen);
  }
  return [...by.values()].sort((a, b) => b.items - a.items || a.name.localeCompare(b.name));
}

export default async function OrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const org = (await searchParams).org?.slice(0, 200) ?? null;
  let orgs: OrgActivity[] | null = null;
  let items: StoredItem[] = [];
  try {
    [orgs, items] = await Promise.all([orgActivity(), org ? itemsByOrg(org) : Promise.resolve([])]);
  } catch {
    orgs = null;
  }
  const institutions = byInstitution(orgs ?? []);
  const companies = companiesIn(orgs ?? []);
  const match = org ? matchDirectory(org) : null;

  return (
    <Shell>
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/science" className="hover:text-fg-primary">
            Science
          </Link>
          <span className="mx-2">/</span>
          <Link href={pipelineHref()} className="hover:text-fg-primary">
            Pipeline
          </Link>
        </nav>
        <SectionHeader
          title={org ?? 'Who is doing the science'}
          lede={
            org
              ? 'Every collected paper, preprint and grant naming this institution, exactly as the source spells it.'
              : 'Institutions named on the collected research and grants — universities, national laboratories, startups and incumbents — and the listed companies among them.'
          }
          stats={
            org
              ? undefined
              : [
                  {
                    label: 'Institutions named',
                    value: <Figure method="science-orgs">{institutions.length}</Figure>,
                  },
                  {
                    label: 'Universities and labs',
                    value: (
                      <Figure method="science-orgs">
                        {institutions.filter((i) => ACADEMIC.has(i.type ?? '')).length}
                      </Figure>
                    ),
                    note: 'as OpenAlex types them',
                  },
                  {
                    label: 'Companies',
                    value: (
                      <Figure method="science-orgs">
                        {institutions.filter((i) => i.type === 'company').length}
                      </Figure>
                    ),
                    note: 'any company OpenAlex names',
                  },
                  {
                    label: 'Directory companies',
                    value: <Figure method="science-orgs">{companies.length}</Figure>,
                    note: 'matched by the strict name rule',
                  },
                ]
          }
          action={
            org ? (
              <Link
                href={pipelineOrgHref()}
                className="text-accent underline-offset-4 hover:underline"
              >
                ← All institutions
              </Link>
            ) : undefined
          }
        />

        {orgs === null && <Empty what="The science feed could not be read just now." />}

        {org && (
          <>
            {match && (
              <p className="mb-6 flex flex-wrap items-center gap-3 text-sm text-fg-secondary">
                <span>In the directory as</span>
                <Link
                  href={marketHref(match.rows[0].slug)}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {match.name}
                </Link>
                <Ticker listing={match.listing} />
              </p>
            )}
            {items.length > 0 ? (
              <ItemList items={items} showBottleneck />
            ) : (
              <Empty what="Nothing collected names this institution." />
            )}
          </>
        )}

        {!org && orgs !== null && (
          <>
            <section className="mb-12">
              <Heading
                title="Listed and directory companies"
                aside="Where the research effort is, by company"
              />
              {companies.length === 0 ? (
                <Empty what="No directory company is named on a collected item yet." />
              ) : (
                <table className="sci-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Trades as</th>
                      <th>Items</th>
                      <th>Bottlenecks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.match.name}>
                        <td>
                          <Link href={marketHref(c.match.rows[0].slug)}>{c.match.name}</Link>
                        </td>
                        <td>
                          <Ticker listing={c.match.listing} compact />
                        </td>
                        <td>
                          <Link href={pipelineOrgHref(c.spelled[0])}>
                            <Figure method="science-orgs" inLink>
                              {c.items}
                            </Figure>
                          </Link>
                        </td>
                        <td className="sci-table-rails">
                          {c.bottlenecks.map((name) => (
                            <Link key={name} href={pipelineHref(name)}>
                              {name}
                            </Link>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section>
              <Heading title="All institutions" aside="Most items first" />
              <table className="sci-table">
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Kind</th>
                    <th>Items</th>
                    <th>Bottlenecks</th>
                  </tr>
                </thead>
                <tbody>
                  {institutions.slice(0, 150).map((i) => (
                    <tr key={i.name}>
                      <td>
                        <Link href={pipelineOrgHref(i.name)}>{i.name}</Link>
                        {i.country && <span className="sci-table-muted"> · {i.country}</span>}
                      </td>
                      <td className="sci-table-muted">{i.type ?? '—'}</td>
                      <td>
                        <Figure method="science-orgs">{i.items}</Figure>
                      </td>
                      <td className="sci-table-rails">
                        {i.bottlenecks.map((name) => (
                          <Link key={name} href={pipelineHref(name)}>
                            {name}
                          </Link>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </Page>
    </Shell>
  );
}
