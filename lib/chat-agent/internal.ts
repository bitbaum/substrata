/**
 * What the reader never sees: our tools, our fields, and our conversation with
 * the model about its draft.
 *
 * Seen live on 2026-10-24, Russia: the answer opened "You are right: the
 * `producers_in` rows do carry the `companies` cells … I summarized those out
 * on the first pass. Rewriting below" and went on with "`read_as` splits this
 * to operator = OAO Apatit". The model was answering the send-back, not the
 * question, in our own vocabulary. The send-backs no longer name a tool or a
 * field (turn.ts REVISION_RULE); this is the check behind that, in code:
 *
 * - a sentence that talks to the send-back ("you are right", "as you said",
 *   "sorry", "rewriting below", "on the first pass") goes;
 * - a field the reader can be told in words is put in words (`companies`
 *   cell → "the USGS entry", `capacity` → "capacity");
 * - a sentence that still names a tool or a field goes.
 */
import { CHAT_TOOLS } from '../chat-tools/registry';

const ADDRESSES =
  /^(?:\*\*)?(you('| a)re (absolutely )?(right|correct)|you('| a)re right to|as you (said|noted|pointed out|asked)|good (catch|point)|thanks? (you )?for (pointing|catching|the (correction|check))|(i'?m |i am )?sorry|(my )?apolog(y|ies|i[sz]e)|i (apologi[sz]e|summari[sz]ed|missed|overlooked|should (have|be clear))|(here is|here's|below is) (the|my) (rewritten|revised|corrected|updated) (answer|version)|rewriting (it )?below)\b|\b(on|in) (the|my) first (pass|draft|answer)\b|\brewriting below\b|\bthe (check|send-back|revision request|instruction) (above|said)\b/i;

/** Field names said in words. */
const IN_WORDS: [RegExp, string][] = [
  [/(?:the )?(?:printed )?`?companies`? cells?(?: as printed)?/gi, 'the USGS entry as printed'],
  [/`(capacity|display|summary|note|status|location|commodity|source|page)`/gi, '$1'],
];

/** Fields and tools that must never reach a reader, in any form. */
const FIELDS = [
  'read_as',
  'printed_once',
  'table_shown',
  'value_number',
  'share_pct',
  'capacity_note',
  'cite_as',
  'key_numbers',
  'matched_by',
  'also_matched',
  'unverified_leads',
  'holds_stakes_in',
  'lookedUp',
];

const NAMES = new RegExp(
  // Only the snake_case names: "ownership" is a tool and an ordinary word.
  `\\b(${[...CHAT_TOOLS.map((t) => t.name).filter((n) => n.includes('_')), ...FIELDS].join('|')})\\b|\\btool (result|call|output)s?\\b|\\bthe (rows|lookups?|tools?) (above )?(do|does|did) (carry|hold|return)|\\bsend-back\\b|\\bnull\\b|\\[W#\\]|\\bthe row note\\b`,
  'i',
);

const SPLIT =
  /(?<=(?<!\b(?:Inc|Corp|Ltd|Co|Plc|plc|JSC|LLP|B\.V|N\.V|S\.A|e\.g|i\.e|No|St))[.!?])\s+(?=[A-Z“"*[(`-]|[a-z]+_[a-z])/;

/** Whether a sentence names our machinery, or talks to the send-back. */
export function internalProblem(
  sentence: string,
): 'addresses the check' | 'names a tool or field' | null {
  if (ADDRESSES.test(sentence.replace(/^[-*•>\s]+/, ''))) return 'addresses the check';
  if (NAMES.test(sentence)) return 'names a tool or field';
  return null;
}

/** The answer in the reader's words only. */
export function withoutInternals(answer: string): string {
  const out: string[] = [];
  let fence = false;
  for (const raw of answer.split('\n')) {
    if (/^\s*```/.test(raw)) fence = !fence;
    if (fence || /^\s*```/.test(raw)) {
      out.push(raw);
      continue;
    }
    const line = IN_WORDS.reduce((l, [re, to]) => l.replace(re, to), raw);
    const lead = line.match(/^\s*(?:[-*•>]|\d+\.)?\s*/)?.[0] ?? '';
    const kept = line
      .slice(lead.length)
      .split(SPLIT)
      .filter((s) => !internalProblem(s))
      .join(' ')
      .trim();
    if (kept) out.push(`${lead}${kept}`);
    else if (!line.trim()) out.push('');
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
