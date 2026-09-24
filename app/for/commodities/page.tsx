import { RolePage, roleMetadata } from '../_views/RolePage';

export const dynamic = 'force-dynamic';
export const metadata = roleMetadata('commodities');

export default function Page() {
  return <RolePage id="commodities" />;
}
