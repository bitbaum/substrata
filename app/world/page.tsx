import { redirect } from 'next/navigation';

import { hasCountryPage } from '@/lib/world/pages';

/**
 * /world?country=xx opens the country's profile when it has one, and its
 * sheet on the globe otherwise; /world alone is the globe. Geography is a
 * view of the map; a country with something to say is a page.
 */
export default async function WorldRedirect({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const id = country?.toLowerCase();
  if (id && hasCountryPage(id)) redirect(`/world/${id}`);
  const query = new URLSearchParams({ view: 'world' });
  if (id) query.set('country', id);
  redirect(`/atlas?${query.toString()}`);
}
