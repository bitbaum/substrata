import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/account/settings',
          '/account/sign-in-error',
          '/review',
          '/sign-in',
          '/sign-up',
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
