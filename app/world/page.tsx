import { redirect } from 'next/navigation';

/** Geography is a view of the map, not a second product. */
export default async function WorldRedirect({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const query = new URLSearchParams({ view: 'world' });
  if (country) query.set('country', country);
  redirect(`/atlas?${query.toString()}`);
}
