/** @type {import('next').NextConfig} */
const nextConfig = {
  // The box's launch.sh looks for a server.js — see loki sync-infra.sh.
  output: 'standalone',
  reactStrictMode: true,
  // The fifteen-table map page became the board and one page per bottleneck.
  // Links to the old page keep working.
  redirects: async () => [{ source: '/map', destination: '/board', permanent: true }],
};
export default nextConfig;
