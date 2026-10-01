/**
 * Does a sweep find REPORT something that happened? The front page shows
 * unchecked finds, so it needs a stricter bar than the desk, where a reader
 * chose the rails and can mute what they do not want.
 *
 * Measured on the live queue (2026-10-01, 203 open finds): a headline that
 * names the bottleneck was not enough — a countertop blog ("2026 U.S. Quartz
 * Tariff & Sintered Stone"), a book chapter, a jewellery-software ad and a
 * trade-fair notice all passed. Requiring a verb of change, and refusing
 * questions, explainers, social posts and product/blog paths, kept 68:
 * export controls eased, a plant closed, a partnership signed, prices up.
 * The examples on both sides are pinned in test/lead-signal.test.ts.
 */

const CHANGE_WORDS =
  `announc\\w* open(s|ed|ing)? clos(e|es|ed|ing|ure) expand\\w* expansions? wins? won
sign(s|ed)? launch\\w* eas(e|es|ed|ing) ban(s|ned)? restrict\\w* curb(s|ed)? halt(s|ed)? cut(s|ting)?
rais(e|es|ed|ing) rise(s|n)? rose fall(s|en)? fell drop(s|ped)? surg(e|es|ed|ing) jump(s|ed)? soar(s|ed)?
plung\\w* slump\\w* approv\\w* invest(s|ed|ing)? plans? acquir\\w* buy(s|ing)? sells? sold delay\\w*
postpon\\w* suspend\\w* begins? began start(s|ed)? complet\\w* breaks? impos\\w* lift(s|ed)? tighten\\w*
loosen\\w* extend\\w* boost(s|ed)? doubles? doubled triples? tripled shut(s|ting)? idl(e|es|ed) resum\\w*
award\\w* order(s|ed)? partner(s|ed|ship)? agree(s|d|ment)? deal mov(e|es|ed) prevent\\w* tariffs?
duty duties sanction\\w* warn(s|ed)? stop(s|ped|ping)? surpass\\w* weighs? nears? exits? reach(es|ed)?
hits? secures? unveil\\w* pledg\\w* commission(s|ed)? builds? withdraw\\w* revok\\w*`
    .split(/\s+/)
    .filter(Boolean);

const CHANGE = new RegExp(`\\b(${CHANGE_WORDS.join('|')})\\b`, 'i');

/** Asks, explains or sells rather than reports. */
const OPINION =
  /\?\s*($|[-|–—])|^(how|why|what|should|can|is|are|will)\b|stock picks|market (trends?|report|size|outlook)|explained\b|what to know|trends to watch/i;

/** Pages that are not news, whatever their title says. */
const NOT_NEWS_PATH =
  /\/blogs?\/|\/knowledge\/|springerprofessional|\/industries\/|\/solutions?\/|\/products?\/|wikipedia\.org|\/glossary|\/learn\/|\/guide/i;

const SOCIAL = /(^|\.|\/\/)(facebook|linkedin|reddit|x|twitter|instagram|youtube)\.com(\/|$)/i;

export function reportsAChange(title: string, url: string): boolean {
  return (
    CHANGE.test(title) && !OPINION.test(title) && !NOT_NEWS_PATH.test(url) && !SOCIAL.test(url)
  );
}

/**
 * A date written into the URL ("/2024/09/20/", "/news/20240920-"), or null.
 * The sweep finds a page when it finds it, not when it was written: a 2024
 * article found this week is still 2024 news.
 */
export function dateInUrl(url: string): string | null {
  const slashed = url.match(/\/(20\d\d)\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(\/|$)/);
  if (slashed) return `${slashed[1]}-${slashed[2]}-${slashed[3]}`;
  const compact = url.match(/[/_-](20\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?=[-_/.]|$)/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return null;
}
