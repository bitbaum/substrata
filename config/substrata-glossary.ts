/**
 * The glossary: every term this subject cannot avoid, in one line each.
 *
 * This lived at the bottom of the About page as one undifferentiated block,
 * rendered through a shared section kind that emits no id per item — so
 * nothing could link to a definition. A reader who hit "GOES" in a table had
 * to find the About page, scroll, and search.
 *
 * Now it owns its own rendering on /learn, each term carries an anchor, and
 * `glossaryHref(term)` in `lib/links.ts` points at it. That is the whole
 * reason for moving it: a definition nobody can link to is a definition
 * nobody reads.
 *
 * The rule for an entry: explain it to someone who has never worked in the
 * industry, in one or two sentences, without using another unexplained term.
 * Where one is unavoidable, name it in `seeAlso` so the reader can follow.
 *
 * Created: 2026-09-15
 */

import { slugify } from '../lib/links';

export interface GlossaryEntry {
  term: string;
  /** What it means, for someone who has never worked in this industry. */
  detail: string;
  /** Other terms a reader will want next. Must themselves be entries. */
  seeAlso?: string[];
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    term: 'The loop',
    detail:
      'Technology improving its own inputs: better tools make better tools. Its speed is set by whatever it waits on longest, which is what this site maps. The nine stages are the things it waits on, from research and data through compute, energy and materials to talent, capital and permission.',
    seeAlso: ['Bottleneck', 'Relief time'],
  },
  {
    term: 'Bottleneck',
    detail:
      'The input that is actually holding something up. Not the most expensive one and not the most talked about — the one that, if you had more of it, would let you build faster. It is a relation rather than a thing: tin is not a bottleneck, but seven-nines tin qualified for one machine, made by three firms, is.',
    seeAlso: ['Severity', 'Qualification'],
  },
  {
    term: 'Severity',
    detail:
      'How hard a bottleneck binds, scored 0 to 12 by hand: four questions worth 0 to 3 each — how few suppliers qualify, how hard it is to replace, how long new capacity takes, and whether the buyer can walk away. Higher is worse for progress. It is a judgement and every page says so.',
    seeAlso: ['Bottleneck'],
  },
  {
    term: 'Relief time',
    detail:
      'How long it takes to loosen a constraint once somebody decides to. It is a property of the stage rather than of anyone’s effort or budget: minutes for software, years for a qualified material. This is why money often does not help.',
    seeAlso: ['The loop', 'Qualification'],
  },
  {
    term: 'Qualification',
    detail:
      'Proving that a material or tool works in one specific factory, for one specific product. It takes months to years and has to be repeated per factory. This is the single most important idea on this site: it is why a substitute that exists in a laboratory does not relieve a shortage.',
    seeAlso: ['Relief time'],
  },
  {
    term: 'Sweep',
    detail:
      'An automated pass that searches for recent pages about each bottleneck and files them as candidates. It never publishes anything. A person reads a candidate before it becomes an event, and most candidates turn out to be market-research pages rather than news.',
    seeAlso: ['Event'],
  },
  {
    term: 'Event',
    detail:
      'Something that happened to a bottleneck, on a date, with a sentence from the source that says so, marked as making things tighter or easier. Accepted by hand.',
    seeAlso: ['Sweep'],
  },
  {
    term: 'Call',
    detail:
      'A dated prediction with the observation that would settle it and a deadline by which reality has to answer. The part of this research that can be wrong, and therefore the part worth judging it on.',
  },
  {
    term: 'EUV and DUV',
    detail:
      'Extreme and deep ultraviolet lithography: the machines that print circuit patterns onto silicon. EUV uses a shorter wavelength and is needed for the most advanced chips. One company in the world builds the machines.',
    seeAlso: ['Photoresist'],
  },
  {
    term: 'Photoresist',
    detail:
      'The light-sensitive coating on a wafer. Light projected through a pattern changes the resist where it lands, and the changed parts wash away, leaving the circuit. The chemistry is qualified per factory and is overwhelmingly Japanese.',
    seeAlso: ['EUV and DUV', 'Qualification'],
  },
  {
    term: 'HBM',
    detail:
      'High-bandwidth memory. Stacks of memory chips bonded next to a processor rather than beside it on the board, which is what lets an AI accelerator be fed fast enough to be worth its price.',
    seeAlso: ['Advanced packaging'],
  },
  {
    term: 'Advanced packaging',
    detail:
      'Assembling several separate chips into one component. Increasingly this, rather than how many wafers a factory can make, decides how many AI accelerators exist.',
    seeAlso: ['HBM'],
  },
  {
    term: 'Wafer',
    detail:
      'The polished disc of silicon that chips are built on, usually 300 mm across. A handful of companies make them; the five tracked here are listed on the wafer page, which says what that list does and does not establish.',
    seeAlso: ['Polysilicon'],
  },
  {
    term: 'Polysilicon',
    detail:
      'Silicon purified to eleven nines — 99.999999999% — and the raw material every wafer starts from. The electronic grade is a different product from the solar grade, and they are not interchangeable.',
    seeAlso: ['Wafer', 'Purity grades'],
  },
  {
    term: 'Purity grades',
    detail:
      'The count of nines. 7N means 99.99999% pure. Each additional nine is usually a different production process and a smaller set of suppliers, which is why "the world has plenty of tin" and "three firms make the tin this machine needs" are both true.',
  },
  {
    term: 'GOES',
    detail:
      'Grain-oriented electrical steel: steel grown so its crystals line up in one direction, which makes it lose far less energy as heat. It goes inside the core of a large power transformer. Few mills make it and a new mill takes years.',
    seeAlso: ['Transformer'],
  },
  {
    term: 'Transformer',
    detail:
      'The equipment that changes electricity between voltages. A data centre cannot take grid power without one, large ones are built to order, and ordering one today means waiting years.',
    seeAlso: ['GOES', 'Interconnection queue'],
  },
  {
    term: 'Interconnection queue',
    detail:
      'The administrative line a new power plant or data centre waits in to be connected to the electricity grid. In several markets it is measured in years and is the slowest step in building anything — and there is nothing to buy to skip it.',
    seeAlso: ['Transformer'],
  },
  {
    term: 'REBCO',
    detail:
      'Rare-earth barium copper oxide, sold as a coated tape. It carries electricity with no resistance when cold enough, which liquid nitrogen can manage, and it is the wire inside modern fusion magnets.',
    seeAlso: ['Superconductor'],
  },
  {
    term: 'Superconductor',
    detail:
      'A material that carries electricity with no losses below a certain temperature. "High-temperature" ones still need to be very cold by everyday standards — just not as cold as the alternatives.',
    seeAlso: ['REBCO'],
  },
  {
    term: 'Rare earths',
    detail:
      'Seventeen metals that are not actually rare in the ground but are hard to separate from one another. They make the strongest permanent magnets, and therefore most electric motors. Separation and magnet-making, rather than mining, are where the concentration is.',
    seeAlso: ['Sintering'],
  },
  {
    term: 'Sintering',
    detail:
      'Pressing a powder and heating it until it fuses into a solid without fully melting. It is how a rare-earth magnet is made, and the step where the supply chain is most concentrated.',
    seeAlso: ['Rare earths'],
  },
  {
    term: 'PGM',
    detail:
      'Platinum group metals: platinum, palladium, rhodium, ruthenium, iridium and osmium. They come out of the ground together, so how much of one exists is decided by demand for the others.',
  },
  {
    term: 'SiC and GaN',
    detail:
      'Silicon carbide and gallium nitride. Semiconductors that tolerate higher voltages and temperatures than plain silicon, so they waste less energy converting power. Used in chargers, motors and increasingly in data centres.',
  },
  {
    term: 'Crucible',
    detail:
      'The container a silicon crystal is grown in, lined with extremely pure quartz. The lining is manufactured; the body is still made from sand from a very small number of deposits.',
    seeAlso: ['Wafer'],
  },
  {
    term: 'Export control',
    detail:
      'A rule requiring government permission before something leaves a country. It is the main way states slow a technology deliberately, and it works on materials, machines and sometimes knowledge.',
    seeAlso: ['Dual-use'],
  },
  {
    term: 'Dual-use',
    detail:
      'Something with both civilian and military uses. It is the legal category that pulls ordinary industrial equipment under export control.',
    seeAlso: ['Export control'],
  },
  {
    term: 'Safeguard',
    detail:
      'A temporary trade restriction a country may impose when a surge of imports threatens its own producers. Unlike an anti-dumping duty it does not require anyone to have behaved unfairly.',
  },
  {
    term: 'Offtake',
    detail:
      'A commitment by a buyer to purchase output for years ahead. It is usually what makes a new plant financeable, which is why it appears exactly when a buyer becomes frightened about supply.',
    seeAlso: ['Project finance'],
  },
  {
    term: 'Project finance',
    detail:
      'A loan secured against one specific asset and the money it will earn, rather than against the company building it. The largest pool of money available to heavy industry and the fussiest: no contracted revenue, no loan.',
    seeAlso: ['Offtake'],
  },
  {
    term: 'Readiness',
    detail:
      'How close a technology is to being usable at scale, scored 1 to 9 on this site. Low numbers mean a laboratory, high numbers mean it is shipping. A judgement, with the reasoning next to it.',
  },
  {
    term: 'Verified, source found, unverified',
    detail:
      'The three states every row on this site can be in. Verified means a person opened a source that says so and the link is on the page. Source found means software located a page that appears to say so and nobody has read it yet. Unverified means neither. Only verified rows are findings.',
  },
];

/** The anchor for a term, and the thing `glossaryHref` points at. */
export function glossaryAnchor(term: string): string {
  return slugify(term);
}

const BY_TERM = new Map(GLOSSARY.map((entry) => [entry.term.toLowerCase(), entry]));

export function glossaryEntry(term: string): GlossaryEntry | undefined {
  return BY_TERM.get(term.toLowerCase());
}

/** Alphabetical, for the reader who is looking one up rather than reading through. */
export function glossaryAlphabetical(): GlossaryEntry[] {
  return [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
}
