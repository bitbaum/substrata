import Link from 'next/link';

import { StatTiles } from '@bitbaum/chartkit/react';
import { policyHref } from '@/lib/links';
import { formatShare, ordinal } from '@/lib/resources/format';
import type { CountryProfile } from '@/lib/world/profile';

/**
 * The country's head: region and code, the name, one line that says the
 * largest thing it holds, its roles in the chain as one row of equal chips,
 * and four tiles, each a link to the section whose rows it counts. Every
 * figure is the length of a list the page then shows.
 */
export function CountryHeader({ p }: { p: CountryProfile }) {
  // The lede leads with a significant share; a country whose measured rows
  // are all small is introduced by what the directory names it for.
  const lead = p.produces.find((r) => r.significant);
  const named = p.unmeasured.map((u) => u.label.toLowerCase());
  const parts = [
    lead
      ? `${lead.share !== null ? `${formatShare(lead.share)} of world ${lead.label.toLowerCase()}` : `${ordinal(lead.rank)} in ${lead.label.toLowerCase()}`} (${lead.seriesLabel.toLowerCase()}, ${lead.year})`
      : named.length > 0
        ? `named in the directory for ${named.join(', ')}`
        : '',
    p.companies.length > 0
      ? `${p.companies.length} ${p.companies.length === 1 ? 'company' : 'companies'} in the corpus`
      : '',
    p.instruments.length > 0
      ? `${p.instruments.length} rule${p.instruments.length === 1 ? '' : 's'} on record`
      : '',
    p.restricts.all.length > 0
      ? `${p.restricts.all.length} export measure${p.restricts.all.length === 1 ? '' : 's'}`
      : '',
  ].filter(Boolean);
  const lede = parts.length
    ? `${parts.join('; ')}.`
    : 'On the map, with nothing measured or recorded yet: a gap, not a judgement.';
  return (
    <header className="place-head">
      <p className="place-kicker">
        {p.region} · {p.iso2.toUpperCase()}
        {p.eu ? ' · EU member' : ''}
      </p>
      <h1 className="place-title">{p.name}</h1>
      <p className="place-lede">{lede}</p>
      <ul className="place-roles" aria-label="Roles in the chain">
        {p.roles.map((r) => (
          <li key={r.id}>
            <span className="place-role">{r.word}</span>
          </li>
        ))}
      </ul>
      <p className="place-source">
        Shares and ranks computed from USGS, EIA and WNA tables; rules from the policy register;
        measures from the OECD inventory.{' '}
        <Link href={`/atlas?view=world&country=${p.iso2}`}>On the map →</Link>
        {p.eu && (
          <>
            {' '}
            · <Link href={policyHref('eu')}>EU policy →</Link>
          </>
        )}
      </p>
      <div className="mt-6">
        <StatTiles
          caption={`${p.name} at a glance`}
          tiles={[
            // The best rank leads, not a count of podiums: a country in no
            // top three opened its strip on "0", which said nothing about the
            // resource the page is about.
            lead
              ? {
                  label: `In world ${lead.label.toLowerCase()}`,
                  value: ordinal(lead.rank),
                  note:
                    p.glance.podium > 0
                      ? `top three in ${p.glance.podium} of ${p.produces.length} resources listed`
                      : `${lead.share !== null ? `${formatShare(lead.share)} of world output, ` : ''}${lead.year}`,
                  href: '#produces',
                }
              : {
                  label: 'Top-three producer',
                  value: p.glance.podium,
                  note:
                    p.produces.length > 0
                      ? `of ${p.produces.length} resources it is listed for`
                      : 'no table lists it',
                  href: p.produces.length > 0 ? '#produces' : undefined,
                },
            {
              label: 'Companies here',
              value: p.glance.companies,
              note: p.companies.length > 0 ? 'in the corpus, graded' : 'none recorded yet',
              // A zero links nowhere: its section is not on the page.
              href: p.glance.companies > 0 ? '#companies' : undefined,
            },
            {
              label: 'Rules it sets',
              value: p.glance.instruments,
              note: p.eu ? 'its own and the EU’s' : 'policy instruments on record',
              href: p.glance.instruments > 0 ? '#country-rules' : undefined,
            },
            {
              label: 'Events',
              value: p.glance.events,
              note: p.events[0] ? `newest ${p.events[0].date}` : 'none accepted yet',
              href: p.glance.events > 0 ? '#country-events' : undefined,
            },
          ]}
        />
      </div>
    </header>
  );
}
