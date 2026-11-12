import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { RESOURCE_KINDS } from '@/config/substrata-resources';
import { SCIENCE } from '@/config/substrata-science';
import { CAPITAL_PROVIDERS } from '@/config/substrata-capital';
import { FACILITIES } from '@/config/substrata-facilities';
import { loops } from '@/lib/kpi/loops';
import { JURISDICTIONS } from '@/config/substrata-jurisdictions';
import { COUNTRIES } from '@/config/substrata-countries';
import { MARKET_SEED } from '@/config/market-seed';
import { AUDIENCES } from '@/config/audiences';
import { allLearn, allNotes } from '@/lib/notes';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = SITE.url.replace(/\/$/, '');

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/bottlenecks`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/atlas`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/markets`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    {
      url: `${base}/markets/directory`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    { url: `${base}/policy`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/capital`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/science`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    {
      url: `${base}/science/pipeline`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${base}/science/pipeline/organisations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    { url: `${base}/learn`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/careers`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/careers/paths`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    {
      url: `${base}/careers/companies`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    { url: `${base}/events`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/notes`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/thesis`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/join`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/changelog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/roadmap`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/exposure`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/xray`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/scenarios`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/data`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/data/companies`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/data/series`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/data/freshness`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/data/quality`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/world`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/calls`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/areas`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/talent`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
  ];

  const audienceRoutes: MetadataRoute.Sitemap = AUDIENCES.map((a) => ({
    url: `${base}/for/${a.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const bottleneckRoutes: MetadataRoute.Sitemap = BOTTLENECKS.map((b) => ({
    url: `${base}/bottlenecks/${b.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const resourceRoutes: MetadataRoute.Sitemap = RESOURCE_KINDS.map((r) => ({
    url: `${base}/resources/${r.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const scienceRoutes: MetadataRoute.Sitemap = SCIENCE.map((s) => ({
    url: `${base}/science/${s.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const capitalRoutes: MetadataRoute.Sitemap = CAPITAL_PROVIDERS.map((c) => ({
    url: `${base}/capital/${c.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const facilityRoutes: MetadataRoute.Sitemap = FACILITIES.map((f) => ({
    url: `${base}/facilities/${f.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const loopRoutes: MetadataRoute.Sitemap = loops().map((l) => ({
    url: `${base}/loops/${l.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const jurisdictionRoutes: MetadataRoute.Sitemap = JURISDICTIONS.map((j) => ({
    url: `${base}/policy/${j.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const countryRoutes: MetadataRoute.Sitemap = COUNTRIES.map((c) => ({
    url: `${base}/world/${c.iso2.toLowerCase()}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const companyRoutes: MetadataRoute.Sitemap = MARKET_SEED.map((c) => ({
    url: `${base}/markets/${c.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const learnRoutes: MetadataRoute.Sitemap = allLearn().map((piece) => ({
    url: `${base}/learn/${piece.slug}`,
    lastModified: piece.publishedAt ? new Date(piece.publishedAt) : now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const notesRoutes: MetadataRoute.Sitemap = allNotes().map((piece) => ({
    url: `${base}/notes/${piece.slug}`,
    lastModified: piece.publishedAt ? new Date(piece.publishedAt) : now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    ...staticRoutes,
    ...audienceRoutes,
    ...bottleneckRoutes,
    ...resourceRoutes,
    ...scienceRoutes,
    ...capitalRoutes,
    ...facilityRoutes,
    ...loopRoutes,
    ...jurisdictionRoutes,
    ...countryRoutes,
    ...companyRoutes,
    ...learnRoutes,
    ...notesRoutes,
  ];
}
