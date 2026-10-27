/**
 * The hosts a source adapter may call, and how politely. An adapter that
 * names a host not on this list fails before the network: a registry we have
 * not read the terms of is not one we scrape. The prose version, with the
 * terms each host sets, is lib/sources/HOSTS.md; test/sources.test.ts keeps
 * the two in step.
 *
 * `scripts/research/add.ts` is not bound by this list (a candidate row may
 * cite any public page); it only borrows the user agent and cache here when
 * the source is on it, so the gate reads exactly the text the adapter read.
 */

export const REPO_URL = 'https://github.com/bitbaum/substrata';

/** Who we are, on every request: a name, the repository, and a contact. */
export const USER_AGENT = `substrata-research/0.1 (+${REPO_URL}; cato@orangecat.ch)`;

/**
 * SEC's fair-access rule wants "company name and contact e-mail" and, checked
 * 2026-10-24 from this sandbox, answers 403 to any agent string carrying a URL
 * or a slash. So EDGAR gets the same identity without the link.
 */
export const SEC_USER_AGENT = 'Substrata-research bitbaum cato@orangecat.ch';

export interface HostRule {
  host: string;
  /** The adapter family, as `lib/sources/registry.ts` names it. */
  family: string;
  /** Minimum gap between two requests to this host. */
  minIntervalMs: number;
  userAgent: string;
  /** Largest body we will read, bytes. PDFs of annual reports run to ~50 MB. */
  maxBytes: number;
  /** Longest a read may take; a 50 MB report over a slow link needs minutes. Default 60 s. */
  timeoutMs?: number;
}

const MB = 1024 * 1024;

export const ALLOWED_HOSTS: readonly HostRule[] = [
  // SEC: at most 10 requests a second; we stay well under it.
  {
    host: 'www.sec.gov',
    family: 'edgar',
    minIntervalMs: 200,
    userAgent: SEC_USER_AGENT,
    maxBytes: 16 * MB,
  },
  {
    host: 'data.sec.gov',
    family: 'edgar',
    minIntervalMs: 200,
    userAgent: SEC_USER_AGENT,
    maxBytes: 16 * MB,
  },
  // GLEIF: 60 requests a minute.
  {
    host: 'api.gleif.org',
    family: 'gleif',
    minIntervalMs: 1100,
    userAgent: USER_AGENT,
    maxBytes: 4 * MB,
  },
  // Wikidata: the query service asks for a descriptive agent and no parallel bursts.
  {
    host: 'query.wikidata.org',
    family: 'wikidata',
    minIntervalMs: 1000,
    userAgent: USER_AGENT,
    maxBytes: 4 * MB,
  },
  {
    host: 'www.wikidata.org',
    family: 'wikidata',
    minIntervalMs: 1000,
    userAgent: USER_AGENT,
    maxBytes: 8 * MB,
  },
  // UN Comtrade public preview: no key, a few calls a minute, 500 rows a call.
  {
    host: 'comtradeapi.un.org',
    family: 'comtrade',
    minIntervalMs: 4000,
    userAgent: USER_AGENT,
    maxBytes: 4 * MB,
  },
  // Yahoo Finance chart endpoint: daily closes for lib/market-data/prices (one
  // call per ticker per day). query2 is the same service on another edge, tried
  // when query1 refuses. Terms and why this source: lib/market-data/prices/chain.ts.
  {
    host: 'query1.finance.yahoo.com',
    family: 'market',
    minIntervalMs: 1000,
    userAgent: USER_AGENT,
    maxBytes: 2 * MB,
  },
  {
    host: 'query2.finance.yahoo.com',
    family: 'market',
    minIntervalMs: 1000,
    userAgent: USER_AGENT,
    maxBytes: 2 * MB,
  },
  // Kazatomprom investor relations: the site and its PDF storage.
  {
    host: 'www.kazatomprom.kz',
    family: 'kazatomprom',
    minIntervalMs: 2000,
    userAgent: USER_AGENT,
    maxBytes: 64 * MB,
    timeoutMs: 600_000,
  },
  // Thematic fund holdings files (lib/sources/etf-holdings.ts): one file per
  // fund per day, published by the issuer for anyone to download.
  ...[
    'assets.ark-funds.com',
    'assets.globalxetfs.com',
    'www.ftportfolios.com',
    'www.defianceetfs.com',
    'www.ssga.com',
  ].map((host) => ({
    host,
    family: 'etf-holdings',
    minIntervalMs: 1500,
    userAgent: USER_AGENT,
    maxBytes: 4 * MB,
  })),
];

export function hostRule(url: string): HostRule | undefined {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return undefined;
    host = parsed.hostname.toLowerCase();
  } catch {
    return undefined;
  }
  return ALLOWED_HOSTS.find((rule) => rule.host === host);
}

export class HostNotAllowed extends Error {
  constructor(url: string) {
    super(
      `${url} is not on the source allow-list (lib/sources/hosts.ts). Add the host there and to HOSTS.md, with its terms, before an adapter may call it.`,
    );
    this.name = 'HostNotAllowed';
  }
}

/** The rule for `url`, or a thrown HostNotAllowed. */
export function assertAllowed(url: string): HostRule {
  const rule = hostRule(url);
  if (!rule) throw new HostNotAllowed(url);
  return rule;
}
