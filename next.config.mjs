/** @type {import('next').NextConfig} */
const nextConfig = {
  // The box's launch.sh looks for a server.js — see loki sync-infra.sh.
  output: 'standalone',
  reactStrictMode: true,
  // Routes that moved as the portal grew sections. Old links keep working.
  redirects: async () => [
    { source: '/map', destination: '/bottlenecks', permanent: true },
    { source: '/board', destination: '/bottlenecks', permanent: true },
    { source: '/participants', destination: '/markets', permanent: true },
    { source: '/chokepoints', destination: '/bottlenecks', permanent: true },
    { source: '/mandate', destination: '/about', permanent: true },
    { source: '/acting', destination: '/about', permanent: true },
    { source: '/disclosure', destination: '/about', permanent: true },
  ],
};
export default nextConfig;
