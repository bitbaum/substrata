/** @type {import('next').NextConfig} */
const nextConfig = {
  // The box's launch.sh looks for a server.js — see loki sync-infra.sh.
  output: 'standalone',
  reactStrictMode: true,
  // Routes that moved as the portal grew sections. Old links keep working.
  redirects: async () => [
    { source: '/blog', destination: '/notes', permanent: true },
    { source: '/blog/:slug', destination: '/notes/:slug', permanent: true },
    { source: '/map', destination: '/bottlenecks', permanent: true },
    { source: '/board', destination: '/bottlenecks', permanent: true },
    { source: '/participants', destination: '/markets', permanent: true },
    { source: '/chokepoints', destination: '/bottlenecks', permanent: true },
    { source: '/mandate', destination: '/about', permanent: true },
    { source: '/acting', destination: '/about', permanent: true },
    { source: '/disclosure', destination: '/about', permanent: true },
    // The member portal is the desk. Temporary, so a portal page of its own
    // can take the address back without a cached redirect in the way.
    { source: '/portal', destination: '/account', permanent: false },
    { source: '/portal/:path*', destination: '/account', permanent: false },
    { source: '/desk', destination: '/account', permanent: false },
  ],
};
export default nextConfig;
