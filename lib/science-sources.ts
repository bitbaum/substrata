/**
 * One request builder and one parser per science feed. Pure: the fetch loop,
 * rate limits and the table are in `lib/science-store.ts`.
 *
 * Every field is kept as the source reports it — citation counts, institution
 * names, amounts — so a number on a page is the source's number on the day it
 * was fetched, never ours. Each API is free and needs no account:
 *   OpenAlex  https://docs.openalex.org (polite pool: mailto)
 *   arXiv     https://info.arxiv.org/help/api (one request per 3 s)
 *   NSF       https://resources.research.gov/common/webapi/awardapisearch-v1.htm
 *   OpenAIRE  https://graph.openaire.eu/docs/apis/graph-api/ (EU CORDIS and national funders)
 *   USAspending https://api.usaspending.gov (DOE awards, including ARPA-E)
 */
import type { ScienceQuery } from '@/config/substrata-pipeline';
import type { Institution, ScienceItem } from './science';

export const CONTACT = 'cato@orangecat.ch';
export const USER_AGENT = `Substrata science pipeline (mailto:${CONTACT})`;

export const quoted = (q: ScienceQuery) => q.phrases.map((p) => `"${p.replace(/"/g, '')}"`);
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000);

export type Json = Record<string, unknown>;
export const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;
export const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
export const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
export const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

// ---------------------------------------------------------------- OpenAlex

/** Newest first over two years, or most cited over five: two views of one literature. */
export function openAlexUrl(q: ScienceQuery, now: Date, order: 'recent' | 'cited'): string {
  const from = isoDay(daysBefore(now, order === 'recent' ? 730 : 1826));
  const params = new URLSearchParams({
    filter: `title_and_abstract.search:${quoted(q).join(' OR ')},from_publication_date:${from}`,
    sort: order === 'recent' ? 'publication_date:desc' : 'cited_by_count:desc',
    'per-page': order === 'recent' ? '40' : '15',
    select:
      'id,doi,title,publication_date,publication_year,cited_by_count,type,primary_location,best_oa_location,authorships,abstract_inverted_index',
    mailto: CONTACT,
  });
  if (process.env.OPENALEX_API_KEY) params.set('api_key', process.env.OPENALEX_API_KEY);
  return `https://api.openalex.org/works?${params}`;
}

/** OpenAlex ships abstracts as word → positions; put the words back in order. */
export function invertedToText(index: unknown): string {
  const words: string[] = [];
  for (const [word, positions] of Object.entries(obj(index))) {
    if (Array.isArray(positions)) for (const p of positions) words[Number(p)] = word;
  }
  return words.filter(Boolean).join(' ');
}

function institutionsOf(authorships: Json[]): Institution[] {
  const seen = new Map<string, Institution>();
  for (const a of authorships) {
    for (const i of arr(a.institutions)) {
      const name = str(i.display_name);
      if (name && !seen.has(name))
        seen.set(name, { name, type: str(i.type), country: str(i.country_code) });
    }
  }
  return [...seen.values()];
}

/** Research outputs. Datasets, errata, peer reviews and front matter are not. */
const WORK_TYPES = new Set([
  'article',
  'preprint',
  'review',
  'book-chapter',
  'dissertation',
  'report',
  'conference-abstract',
  'proceedings-article',
]);

export function parseOpenAlex(json: unknown): ScienceItem[] {
  return arr(obj(json).results).flatMap((w): ScienceItem[] => {
    const id = str(w.id)?.replace('https://openalex.org/', '');
    const title = str(w.title);
    if (!id || !title || !WORK_TYPES.has(String(w.type))) return [];
    const primary = obj(w.primary_location);
    const oa = obj(w.best_oa_location);
    const doi = str(w.doi)?.replace(/^https?:\/\/doi\.org\//, '') ?? null;
    const preprint =
      w.type === 'preprint' || /arxiv/i.test(str(obj(primary.source).display_name) ?? '');
    return [
      {
        id: `openalex:${id}`,
        source: 'openalex',
        kind: preprint ? 'preprint' : 'paper',
        title: title.replace(/<[^>]+>/g, ''),
        abstract: invertedToText(w.abstract_inverted_index),
        venue: str(obj(primary.source).display_name),
        year: num(w.publication_year),
        publishedOn: str(w.publication_date),
        url: doi
          ? `https://doi.org/${doi}`
          : (str(primary.landing_page_url) ?? `https://openalex.org/${id}`),
        doi,
        pdfUrl: str(oa.pdf_url) ?? str(primary.pdf_url),
        citations: num(w.cited_by_count),
        institutions: institutionsOf(arr(w.authorships)),
        funder: null,
        programme: null,
        amount: null,
        currency: null,
      },
    ];
  });
}

// ---------------------------------------------------------------- arXiv

export function arxivUrl(q: ScienceQuery): string {
  const clauses = quoted(q).flatMap((p) => [`ti:${p}`, `abs:${p}`]);
  const params = new URLSearchParams({
    search_query: clauses.join(' OR '),
    sortBy: 'submittedDate',
    sortOrder: 'descending',
    max_results: '30',
  });
  return `https://export.arxiv.org/api/query?${params}`;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : null;
};

/** The Atom feed, read with patterns: it is a fixed, flat format. */
export function parseArxiv(xml: string): ScienceItem[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(([, entry]): ScienceItem[] => {
    const abs = tag(entry, 'id');
    const title = tag(entry, 'title');
    const id = abs?.match(/arxiv\.org\/abs\/([^v\s]+)/)?.[1];
    if (!abs || !title || !id) return [];
    const published = tag(entry, 'published');
    const affiliations = [
      ...entry.matchAll(/<arxiv:affiliation[^>]*>([\s\S]*?)<\/arxiv:affiliation>/g),
    ]
      .map((m) => decode(m[1]))
      .filter((n, i, all) => all.indexOf(n) === i);
    return [
      {
        id: `arxiv:${id}`,
        source: 'arxiv',
        kind: 'preprint',
        title,
        abstract: tag(entry, 'summary') ?? '',
        venue: 'arXiv',
        year: published ? Number(published.slice(0, 4)) : null,
        publishedOn: published?.slice(0, 10) ?? null,
        url: `https://arxiv.org/abs/${id}`,
        doi: tag(entry, 'arxiv:doi'),
        pdfUrl: `https://arxiv.org/pdf/${id}`,
        citations: null,
        institutions: affiliations.map((name) => ({ name, type: null, country: null })),
        funder: null,
        programme: null,
        amount: null,
        currency: null,
      },
    ];
  });
}
