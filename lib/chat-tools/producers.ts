/**
 * Who runs the mines and plants in a country, and who owns them — the USGS
 * Minerals Yearbook "Structure of the mineral industry" rows, read by a tool.
 *
 * Asked on 2026-10-24 "Which companies mine uranium in Kazakhstan, who owns
 * them, and who do they sell to?", the Ask said the mining entities and their
 * owners "are not recorded in the corpus". research/usgs-producers.json held
 * 35 Kazakh facility rows, the uranium one naming every joint venture and its
 * shareholders with their stakes. Only the pages read the file. This is rung 2
 * of the answer ladder (docs/architecture/2026-10-24-research-systems.md §1).
 *
 * The same discipline as resources.ts: the company string is returned exactly
 * as USGS prints it (`companies`), and the operator / owner split beside it is
 * a reading of that string, never a replacement for it. A capacity is the
 * table's number and unit as printed (`display`); it is never re-united.
 */
import places from '@/research/producer-places.json';
import {
  allFacilitiesFor,
  facilityResources,
  PRODUCERS_SOURCE,
  yearbookCountries,
  type Facility,
} from '../resources/producers';
import { resolveIn } from '../entities/registry';
import { countryHref } from '@/lib/world/pages';
import { tableFields } from './facility-summary';
import { facilityTable } from './facility-table';
import { remember } from './ledger';
import { resourceIn } from './resources';
import { norm } from './resolve';
import { str, type ChatTool } from './tool';

const MAX_ROWS = 14;

interface Place {
  iso2: string;
  location: string;
  lat: number;
  lon: number;
  precision: string;
  matched: string;
}
const PLACES = (places as unknown as { places: Place[] }).places;

/** One company named in a USGS row: the operator, and the owner text as printed. */
export interface CompanyReading {
  /** Null when USGS prints only the shareholders, not a separate operating company. */
  operator: string | null;
  /** The ownership as USGS prints it, verbatim (brackets removed), or null when none is printed. */
  owner: string | null;
}

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

/** A bracketed group starting at `i`, balanced; an unclosed one runs to the end. */
function groupAt(s: string, i: number): { inner: string; end: number } {
  const stack: string[] = [];
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return { inner: s.slice(i + 1, j), end: j + 1 };
    }
  }
  return { inner: s.slice(i + 1), end: s.length };
}

/**
 * A parenthesis that only abbreviates the name — "(Chinalco)", "(SMCC LLP)" —
 * rather than naming an owner: no stake, at most two words.
 */
function isAbbreviation(inner: string): boolean {
  return !/%/.test(inner) && inner.trim().split(/\s+/).length <= 2;
}

/** One entry: the name up to its owner group, the owner group verbatim. */
function readEntry(entry: string): CompanyReading {
  const s = entry.trim();
  let i = 0;
  let name = '';
  while (i < s.length) {
    const c = s[i];
    if (OPEN[c]) {
      const g = groupAt(s, i);
      if (c === '(' && isAbbreviation(g.inner)) {
        name += s.slice(i, g.end);
        i = g.end;
        continue;
      }
      return { operator: name.trim().replace(/[,;]$/, ''), owner: g.inner.trim() || null };
    }
    name += c;
    i++;
  }
  // No bracket: a bare stake list ("Cameco Corp., 69.805%, and Orano, 30.195%")
  // is the ownership itself.
  return /%/.test(s) ? { operator: null, owner: s } : { operator: s, owner: null };
}

/**
 * The companies in a USGS cell. Most cells name one operator; a few (the
 * Kazakh uranium row) list every venture after "Companies:", each followed by
 * its shareholders — those are split at the end of each owner group.
 */
export function readCompanies(cell: string): CompanyReading[] {
  const s = cell.trim();
  if (!/^companies:/i.test(s)) return [readEntry(s)];
  const body = s.replace(/^companies:\s*/i, '');
  const out: CompanyReading[] = [];
  let i = 0;
  let start = 0;
  while (i < body.length) {
    const c = body[i];
    if (OPEN[c]) {
      const g = groupAt(body, i);
      i = g.end;
      if (c === '(' && isAbbreviation(g.inner)) continue;
      // Another group straight after (a second bracket) belongs to the same entry.
      while (OPEN[body[i + 1]] && body[i] === ' ') i = groupAt(body, i + 1).end;
      out.push(readEntry(body.slice(start, i)));
      start = i;
      continue;
    }
    i++;
  }
  const tail = body.slice(start).trim();
  if (tail) out.push(readEntry(tail));
  return out.filter((r) => r.operator || r.owner);
}

export function capacityOf(f: Facility): { display: string | null; note?: string } {
  const raw = f.capacity.trim();
  if (!raw || /^na$/i.test(raw))
    return { display: null, note: 'USGS prints no capacity for this row (NA).' };
  // Verbatim: the number as printed and the row's own unit, nothing re-united.
  return { display: /^[\d,.]+$/.test(raw) ? `${raw} ${f.unit}` : raw };
}

function placeOf(iso2: string, location: string) {
  const p = PLACES.find((x) => x.iso2 === iso2 && x.location === location);
  return p
    ? { lat: p.lat, lon: p.lon, precision: p.precision, matched_place: p.matched }
    : undefined;
}

/** The resource id a USGS chapter files rows under, from any word a reader uses for it. */
export function producerResource(text: string): string | undefined {
  const ids = facilityResources();
  const viaTables = resourceIn(text)?.resource;
  if (viaTables && ids.includes(viaTables)) return viaTables;
  const q = ` ${norm(text)} `;
  return ids.find(
    (id) => q.includes(` ${norm(id)} `) || q.includes(` ${norm(id).replace(/s$/, '')} `),
  );
}

/** Every resource a question names that the chapters file rows under, in the order named. */
export function producerResourcesIn(text: string): string[] {
  const q = ` ${norm(text)} `;
  const first = producerResource(text);
  const named = facilityResources()
    .map((id) => ({ id, at: q.indexOf(` ${norm(id).replace(/s$/, '')}`) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.id);
  return [...new Set([...(first ? [first] : []), ...named])];
}

/** A USGS row as a reader is handed it: the cell verbatim, its reading, place and capacity. */
export function facilityRow(iso2: string, f: Facility) {
  const cap = capacityOf(f);
  const place = placeOf(iso2, f.location);
  return {
    commodity: f.commodity,
    companies: f.companies,
    read_as: readCompanies(f.companies),
    location: f.location,
    ...(place ? { place } : {}),
    capacity: cap.display,
    ...(cap.note ? { capacity_note: cap.note } : {}),
  };
}
export const PRODUCER_TOOLS: ChatTool[] = [
  {
    name: 'producers_in',
    description:
      "The mines, plants and refineries in a country, from the USGS Minerals Yearbook country chapter: each row's operating company, its owner(s) and stakes exactly as USGS prints them, location, capacity with its unit, and the chapter year and source. Use for 'which companies mine/produce X in Y', 'who owns them', 'who operates'. Give `country`, and `resource` to narrow (e.g. uranium, lithium, gallium, nickel, rare earths).",
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Country name, e.g. Kazakhstan, Chile' },
        resource: { type: 'string', description: 'e.g. uranium, lithium, gallium; omit for all' },
      },
      required: ['country'],
    },
    label: (a) =>
      `Reading USGS facility rows${str(a.resource) ? ` for ${str(a.resource)}` : ''}${str(a.country) ? ` in ${str(a.country)}` : ''}`,
    budget: 7000,
    run: async (a, env) => {
      const country = resolveIn('country', str(a.country));
      if (!country) return { error: `No country called "${str(a.country)}".` };
      const iso2 = country.key;
      const resource = str(a.resource) ? producerResource(str(a.resource)) : undefined;
      if (str(a.resource) && !resource)
        return {
          error: `No USGS facility rows are filed under "${str(a.resource)}".`,
          filed_under: facilityResources(),
        };
      const chapter = allFacilitiesFor(iso2);
      if (!chapter)
        return {
          country: country.name,
          facilities: [],
          note: `No USGS Minerals Yearbook country chapter has been read for ${country.name} (chapters read for ${yearbookCountries().length} countries).`,
          missing: `the operating companies in ${country.name}: a USGS country chapter, the national mining cadastre or the companies' own filings would settle it`,
        };
      const source = {
        label: PRODUCERS_SOURCE.label,
        url: chapter.pdf || chapter.url,
        year: chapter.year,
      };
      const rows = resource ? chapter.rows.filter((f) => f.resource === resource) : chapter.rows;
      remember(env.ledger, {
        title: `USGS Minerals Yearbook ${chapter.year}: ${country.name}${resource ? `, ${resource}` : ''} facilities`,
        href: countryHref(iso2, resource),
        kind: 'country',
        evidence: 'Sourced',
        primary: [source.url],
      });
      if (!rows.length)
        return {
          country: country.name,
          resource,
          year: chapter.year,
          facilities: [],
          note: `The USGS ${chapter.year} chapter for ${country.name} lists no ${resource} facility.`,
          chapter_lists: [...new Set(chapter.rows.map((r) => r.resource))],
          source,
        };
      const table = facilityTable({
        country: country.name,
        iso2,
        resource,
        year: chapter.year,
        table: chapter.table,
        url: source.url,
        sourceLabel: PRODUCERS_SOURCE.label,
        rows,
      });
      return {
        country: country.name,
        ...(resource ? { resource } : {}),
        year: chapter.year,
        page: countryHref(iso2, resource),
        facilities: rows.slice(0, MAX_ROWS).map((f) => facilityRow(iso2, f)),
        ...(rows.length > MAX_ROWS
          ? { more: `${rows.length - MAX_ROWS} more rows in the chapter` }
          : {}),
        source,
        note: '`companies` is the cell exactly as USGS prints it; quote owners and stakes from it verbatim. `read_as` only splits it into operator and owner. Copy `capacity` exactly — same number, same unit. Capacity is not production, and these rows name no buyers.',
        // Many rows: the reader gets them as a table under the answer (registry.ts
        // routes `table` there, never to the model); the model gets the computed
        // `summary` to copy and the rules for the rest (facility-summary.ts).
        ...tableFields(table, iso2),
        status: `Sourced (USGS Minerals Yearbook ${chapter.year}, a primary statistical source; company structure as of that year)`,
      };
    },
  },
];
