import { RolePage, roleMetadata } from '../_views/RolePage';

export const dynamic = 'force-dynamic';
export const metadata = roleMetadata('jobs');

export default function Page() {
  return <RolePage id="jobs" />;
}
