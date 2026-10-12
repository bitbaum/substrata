/**
 * The human-capital lens: which kinds of work the bottleneck needs to grow,
 * what those jobs are called in the official occupation registers, where
 * people train for them, and where its makers hire.
 *
 * The families a bottleneck needs are Substrata's judgement, dated
 * (config/careers-roles.ts); open postings counted on /careers are the
 * evidence that tests it, and the lens points there rather than counting them
 * here (the postings live in the database, the panel reads files).
 */
import { BOTTLENECK_NEEDS, FAMILY_BY_ID, NEEDS_JUDGED_ON } from '@/config/careers-roles';
import type { Bottleneck } from '@/lib/bottlenecks';
import { boardFor } from '@/lib/job-boards';
import { pathsFor } from '@/lib/learning-paths';
import { occupationsOf } from '@/lib/occupations';
import { makersOf } from '@/lib/participants';
import { countryName } from '../chain-data';
import { listWords } from '../chain-story';
import { count, top, type Lens } from './types';

const KIND: Record<string, string> = {
  university: 'University',
  college: 'College',
  apprenticeship: 'Apprenticeship',
  academy: 'Company academy',
  government: 'Public programme',
  online: 'Online',
};

function where(country: string): string {
  if (country === 'online') return 'online';
  if (country === 'EU') return 'EU';
  return countryName(country);
}

export function peopleLens(chain: Bottleneck): Lens {
  const families = (BOTTLENECK_NEEDS[chain.slug] ?? [])
    .map((id) => FAMILY_BY_ID.get(id))
    .filter((f) => f !== undefined);
  const paths = pathsFor(families.map((f) => f.id));
  const occupations = families.flatMap((f) =>
    occupationsOf(f.id).map((o) => ({ family: f.label, o })),
  );
  const hiring = makersOf(chain.name)
    .map((m) => ({ name: m.name, board: boardFor(m.slug) }))
    .filter((m) => m.board?.careersUrl);
  const changers = paths.filter((p) => p.careerChangers);

  const means: string[] = [];
  if (families.length > 0) {
    const kinds = families.map((f) => f.label.toLowerCase());
    means.push(
      families.length === 1
        ? `Growing it takes one kind of work: ${kinds[0]}. ${families[0].who}`
        : `Growing it takes ${families.length} kinds of work: ${kinds.join('; ')}.`,
    );
    means.push(
      paths.length > 0
        ? `${count(paths.length, 'training route is', 'training routes are')} on file for that work${changers.length ? `, ${changers.length} open to career changers` : ''}${hiring.length ? `; ${listWords(hiring.map((h) => h.name))} ${hiring.length === 1 ? 'hires' : 'hire'} directly` : ''}.`
        : 'No training route for that work is on file yet.',
    );
  } else {
    means.push('Which kinds of work it needs has not been judged for it yet.');
  }

  return {
    id: 'people',
    label: 'People',
    question: 'What it means for jobs and skills',
    means,
    figures: [
      { label: 'Kinds of work', value: String(families.length), note: `judged ${NEEDS_JUDGED_ON}` },
      { label: 'Training routes', value: String(paths.length) },
      { label: 'Makers hiring direct', value: String(hiring.length) },
    ],
    groups: [
      ...(families.length > 0
        ? [
            {
              title: 'The work, and what registers call it',
              items: families.map((f) => {
                const titles = occupations
                  .filter((x) => x.family === f.label)
                  .map((x) => x.o.onet?.title ?? x.o.esco?.title)
                  .filter(Boolean) as string[];
                return {
                  title: f.label,
                  meta: titles.length ? titles.slice(0, 3).join(' · ') : undefined,
                  text: f.who,
                  href: `/careers/paths#${f.id}`,
                };
              }),
            },
          ]
        : []),
      ...(paths.length > 0
        ? [
            {
              title: 'Where to train',
              items: top(paths, 6).map((p) => ({
                title: p.name,
                meta: `${KIND[p.kind] ?? p.kind} · ${p.provider} · ${where(p.country)}${p.careerChangers ? ' · career changers' : ''}`,
                href: p.url,
                external: true,
              })),
            },
          ]
        : []),
      ...(hiring.length > 0
        ? [
            {
              title: 'Where its makers hire',
              items: hiring.map((h) => ({
                title: h.name,
                meta: 'careers page',
                href: h.board!.careersUrl!,
                external: true,
              })),
            },
          ]
        : []),
    ],
    more: [
      { label: 'Open roles in it', href: `/careers?bottleneck=${chain.slug}` },
      { label: 'Careers in this bottleneck', href: `/careers/${chain.slug}` },
    ],
    weight: families.length + paths.length,
  };
}
