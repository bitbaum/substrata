import Link from 'next/link';
import { FAMILY_BY_ID, type RoleFamilyId } from '@/config/careers-roles';
import type { JobFollows } from '@/lib/job-follows';
import type { MarketParticipant } from '@/lib/participants';
import { followJobs } from '../actions';

/** Follow the company or family being looked at, so its new roles reach the desk. */
export function FollowJobs({
  follows,
  company,
  family,
}: {
  follows: JobFollows;
  company: MarketParticipant | undefined;
  family: RoleFamilyId | undefined;
}) {
  const items = [
    company && {
      kind: 'company',
      id: company.slug,
      label: `new roles at ${company.name}`,
      on: follows.companies.includes(company.slug),
    },
    family && {
      kind: 'family',
      id: family,
      label: `new ${FAMILY_BY_ID.get(family)?.label.toLowerCase()} roles`,
      on: follows.families.includes(family),
    },
  ].filter((x): x is { kind: string; id: string; label: string; on: boolean } => Boolean(x));

  return (
    <div className="careers-follow">
      {items.map((item) => (
        <form key={item.kind} action={followJobs}>
          <input type="hidden" name="kind" value={item.kind} />
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="on" value={item.on ? '0' : '1'} />
          <button type="submit" className={item.on ? 'is-on' : undefined}>
            {item.on ? `Following ${item.label}` : `Follow ${item.label} on your desk`}
          </button>
        </form>
      ))}
      <p>
        Following both narrows to one company&rsquo;s roles in that family. New roles appear on your{' '}
        <Link href="/account">desk</Link> the day after they are posted.
      </p>
    </div>
  );
}
