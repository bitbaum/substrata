import type { MetadataRoute } from 'next';

/**
 * The web app manifest. Without it Android and desktop browsers never offer
 * "Install app", so the site could only be pinned as a bookmark. The PNGs in
 * public/app-icons/ are rasterised from the app icon (192, 512, and a maskable
 * 512 with the icon inside the 80% safe zone); regenerate them when it changes.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Substrata',
    short_name: 'Substrata',
    description:
      'What is holding back compute, energy, materials and robots: what each constraint is, who makes it, which rules govern it and what would remove it.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b0d0d',
    theme_color: '#0b0d0d',
    icons: [
      { src: '/app-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/app-icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
