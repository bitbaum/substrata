import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LAB_TYPE_LABEL, LABS, labById } from '@/config/substrata-labs';
import { correctionUrl } from '@/lib/site';
import { Page, Shell } from '@/components/portal/Shell';
import { EntityProfile } from '@/components/portal/EntityProfile';
import { resolveIn } from '@/lib/entities/registry';
import { countryHref, countryNameOf } from '@/lib/world/pages';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return LABS.map((lab) => ({ slug: lab.id }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const lab = labById(slug);
  return lab
    ? {
        title: lab.name,
        description: `${LAB_TYPE_LABEL[lab.type]} in ${countryNameOf(lab.place)}: what it works on and how to join.`,
      }
    : {};
}

/**
 * One lab: an institute, university group or national laboratory that
 * researches or trains people for a tracked bottleneck. The same frame as a
 * facility or a company — header, then the profile modules (what it works on,
 * where and how to join, stated funders, discussion).
 */
export default async function LabPage({ params }: RouteParams) {
  const { slug } = await params;
  const lab = labById(slug);
  if (!lab) notFound();
  const entity = resolveIn('lab', lab.id);

  return (
    <Shell>
      <Page>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
          <Link href="/science" className="hover:text-fg-primary">
            Science
          </Link>
          <span className="mx-2">/</span>
          {LAB_TYPE_LABEL[lab.type]}
        </nav>

        <header className="mb-8 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {LAB_TYPE_LABEL[lab.type]}
            {lab.evidence === 'candidate' ? ' · candidate source, not yet reviewed' : ''}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary wrap-anywhere sm:text-4xl">
            {lab.name}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link
              href={countryHref(lab.place)}
              className="tap text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
            >
              {lab.where ? `${lab.where}, ` : ''}
              {countryNameOf(lab.place)}
            </Link>
            <a
              href={correctionUrl(lab.name)}
              className="tap text-accent underline-offset-4 hover:underline"
            >
              Report an error on GitHub
            </a>
          </div>
        </header>

        {entity && <EntityProfile entity={entity} />}
      </Page>
    </Shell>
  );
}
