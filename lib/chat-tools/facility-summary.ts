/**
 * The headline of a facility table, computed — never written by the model.
 *
 * Seen live on 2026-10-24, after the table shipped: the model still wrote
 * its own aggregates over the rows, and they were wrong in the way small
 * models are wrong about sets: "17 mining joint-ventures" (sixteen ventures
 * and a rare-earth plant), "Kazatomprom holds at least 49% in all of them"
 * (true only by luck; its stake in SMCC is 30%), "Uranium One Inc. (up to
 * 50%)" (Uranium One Rotterdam B.V. holds 70% of SMCC). So the sentences a
 * reader most wants — how many, who is in most of them, the range of their
 * stakes — are counted here from the parsed rows and handed to the model as
 * `summary`, to copy exactly. lib/chat-agent/table-guard.ts sends back an
 * answer that states an aggregate of its own.
 */
import type { AnswerTable } from '../chat/answer-table';
import { resolveEntity } from '../entities/registry';
import { resolveParty } from '../graph/parties';
import { readCell } from '../graph/usgs-cell';
import type { Party } from '../graph/usgs-grammar';

interface Holding {
  name: string;
  share: number | null;
}

/** The holders a row's owners cell names, keyed to one id per organisation (reviewed aliases merged). */
function holdersOf(owners: string, iso2: string): Map<string, Holding> {
  const out = new Map<string, Holding>();
  let parties: Party[] = [];
  try {
    const shape = readCell(owners);
    parties = shape.kind === 'holders' ? shape.holders : [];
  } catch {
    return out;
  }
  for (const p of parties) {
    const r = resolveParty(p.name, { iso2, abbr: p.abbr });
    if ('skip' in r) continue;
    // "Government" is the country whose chapter printed it: say which.
    const country = r.id.startsWith('country:') ? resolveEntity(r.id)?.name : undefined;
    const name = country ? `${p.name} (${country})` : (r.name ?? p.name);
    if (!out.has(r.id)) out.set(r.id, { name, share: p.share ?? null });
  }
  return out;
}

/** "a, b and c". */
const list = (xs: string[]) =>
  xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** "30%": the share as the yearbook prints a stake. */
const pct = (n: number) => `${n}%`;

/** The computed sentences, in the order a reader needs them. */
export function facilitySummary(table: AnswerTable, iso2: string): string[] {
  const n = table.rows.length;
  const byCommodity = new Map<string, number>();
  for (const r of table.rows) {
    const c = r.commodity ?? 'no commodity printed';
    byCommodity.set(c, (byCommodity.get(c) ?? 0) + 1);
  }
  const groups = [...byCommodity].sort((a, b) => b[1] - a[1]);
  const out = [
    groups.length === 1
      ? `The table has ${n} rows, all for “${groups[0][0]}”.`
      : `The table has ${n} rows: ${list(groups.map(([c, k]) => `${k} for “${c}”`))}.`,
  ];
  const owners = new Map<string, { name: string; rows: number; shares: number[]; none: number }>();
  for (const r of table.rows) {
    if (!r.owners) continue;
    for (const [id, h] of holdersOf(r.owners, iso2)) {
      const o = owners.get(id) ?? { name: h.name, rows: 0, shares: [], none: 0 };
      o.rows += 1;
      if (h.share === null) o.none += 1;
      else o.shares.push(h.share);
      owners.set(id, o);
    }
  }
  const ranked = [...owners.values()].filter((o) => o.rows > 1).sort((a, b) => b.rows - a.rows);
  for (const o of ranked.slice(0, 3)) {
    const min = Math.min(...o.shares);
    const max = Math.max(...o.shares);
    const range = !o.shares.length
      ? ''
      : min === max
        ? `; its stated share is ${pct(min)} in each`
        : `; its stated shares range from ${pct(min)} to ${pct(max)}`;
    const none = o.none ? `; no share is printed for ${o.none}` : '';
    out.push(`${o.name} is named as an owner in ${o.rows} of the ${n} rows${range}${none}.`);
  }
  return out;
}

/** What producers_in adds to its result when it has a table: the table (for the reader), the rest for the model. */
export function tableFields(table: AnswerTable | null, iso2: string) {
  if (!table) return {};
  const summary = facilitySummary(table, iso2);
  // A long place list is not repeated to the model; a capacity is the figure that gets copied per row.
  const once = table.shared.map((s) => s.text).filter((t) => t.length <= 120);
  return {
    table,
    summary,
    ...(once.length ? { printed_once: once } : {}),
    table_shown: `The reader sees all ${table.rows.length} rows as a table under your answer. Do NOT write a table or a list of the rows. Open with the \`summary\` sentences, copied exactly — they are counted from the rows; never state a count, a range, a "largest", an "at least" or an "up to" of your own.${once.length ? ` ${once.map((t) => `"${t}"`).join(' and ')} ${once.length === 1 ? 'is' : 'are'} printed ONCE for several rows together: never give ${once.length === 1 ? 'it' : 'them'} per row.` : ''} Quote any name or share you mention exactly as printed ("50%", never "50 %"), and refer to "the table below".`,
  };
}
