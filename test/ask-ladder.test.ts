/**
 * The answer ladder (docs/architecture/2026-10-24-research-systems.md §1):
 * the research files read by tools, the missing link named, the web tried for
 * it, the wall sent back, the gap filed. The Kazakhstan question is the one
 * the live Ask answered with a wall on 2026-10-24.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runTool } from '../lib/chat-tools/registry';
import { emptyLedger, type ToolEnv } from '../lib/chat-tools/ledger';
import { readCompanies } from '../lib/chat-tools/producers';
import { planLookups } from '../lib/chat-agent/plan';
import { readerContext } from '../lib/chat-context';
import { missingLinks, wallProblem, webStatusOf } from '../lib/chat-agent/ladder';
import { unsupportedFigures } from '../lib/chat-agent/grounding';
import { systemPrompt } from '../lib/chat-agent/prompt';
import { runAgent, type AgentAnswer, type AgentEvent } from '../lib/chat-agent/loop';
import { fileGap, setGapFiler, type GapReport } from '../lib/chat-agent/gaps';
import type { ModelTurn } from '../lib/chat-agent/turn';

const KZ = 'Which companies mine uranium in Kazakhstan, who owns them, and who do they sell to?';
/** The answer the live Ask gave, near verbatim. */
const LIVE_WALL =
  'Kazakhstan mined 23,270 t of uranium in 2024, 38.6% of world output. However, the mining entities, ownership details, and buyer relationships for Kazakh uranium are not recorded in the corpus.';

const env = (extra: Partial<ToolEnv> = {}): ToolEnv => ({ ledger: emptyLedger(), ...extra });
const call = async (name: string, args: Record<string, unknown>) =>
  (await runTool(name, args, env())).result;

test('producers_in returns the Kazakh uranium ventures with their owners, verbatim', async () => {
  const raw = await call('producers_in', { country: 'Kazakhstan', resource: 'uranium' });
  const out = JSON.parse(raw);
  assert.equal(out.year, '2023');
  assert.match(out.source.url, /usgs\.gov/);
  const row = out.facilities.find((f: { commodity: string }) => /U content/.test(f.commodity));
  assert.ok(row, 'the uranium row');
  assert.match(row.companies, /APPAK LLP \(NAC Kazatomprom JSC, 65%; Sumitomo Corp\., 25%/);
  assert.equal(row.capacity, '24000 metric tons', 'capacity as printed, with its unit');
  const inkai = row.read_as.find((c: { operator: string }) => c.operator === 'JV Inkai LLP');
  assert.equal(inkai.owner, 'NAC Kazatomprom JSC, 60%, and Cameco Corp., 40%');
  assert.ok(row.read_as.length >= 15, `every venture is read (${row.read_as.length})`);
});

test('a USGS company cell is read into operator and owner without rewriting either', () => {
  assert.deepEqual(readCompanies('Balkhashtsvetmet PA (Kazakhmys Corp. LLP, 100%)'), [
    { operator: 'Balkhashtsvetmet PA', owner: 'Kazakhmys Corp. LLP, 100%' },
  ]);
  assert.deepEqual(readCompanies('Aluminum Corporation of China (Chinalco)'), [
    { operator: 'Aluminum Corporation of China (Chinalco)', owner: null },
  ]);
  assert.deepEqual(readCompanies('Cameco Corp., 69.805%, and Orano, 30.195%'), [
    { operator: null, owner: 'Cameco Corp., 69.805%, and Orano, 30.195%' },
  ]);
  // Unbalanced, as USGS sometimes prints it: the owner runs to the end.
  assert.equal(
    readCompanies('Kazzinc Ltd. [Glencore plc, 69.7%, and NMC Tau-Ken')[0].owner,
    'Glencore plc, 69.7%, and NMC Tau-Ken',
  );
});

test('a country with no yearbook chapter says what would settle it, never a bare zero', async () => {
  const out = JSON.parse(await call('producers_in', { country: 'Bolivia', resource: 'lithium' }));
  assert.deepEqual(out.facilities, []);
  assert.match(out.note, /lists no lithium/);
  assert.ok(out.chapter_lists.length > 0);
});

test('restrictions_on and sanctions_on read the OECD and sanctions files', async () => {
  const r = JSON.parse(await call('restrictions_on', { resource: 'gallium', country: 'China' }));
  assert.ok(r.measures.length > 0);
  assert.ok(r.measures.every((m: { country: string }) => m.country === 'CN'));
  assert.match(r.measures[0].measure, /gallium|metal|Licensing|Export/i);
  const s = JSON.parse(await call('sanctions_on', { name: 'Russia' }));
  assert.ok(s.eu_regimes.length > 0 && s.us_programs.length > 0);
  const company = JSON.parse(await call('sanctions_on', { name: 'Kazatomprom' }));
  assert.match(company.note, /not read/, 'a company is told apart from a country, honestly');
});

test('the Kazakhstan question plans producers_in first', () => {
  const plan = planLookups(KZ, readerContext({}), {});
  assert.equal(plan.calls[0].name, 'producers_in');
  assert.deepEqual(JSON.parse(plan.calls[0].args), { country: 'Kazakhstan', resource: 'uranium' });
});

test('grounding accepts facility figures copied verbatim and catches them re-united', async () => {
  const raw = `[producers_in] ${await call('producers_in', { country: 'Kazakhstan', resource: 'uranium' })}`;
  assert.deepEqual(
    unsupportedFigures(
      'APPAK LLP is owned by NAC Kazatomprom JSC (65%), Sumitomo Corp. (25%) and Kansai Electric Power Co. Inc. (10%); the ventures together have 24000 metric tons of capacity.',
      raw,
    ),
    [],
  );
  assert.ok(unsupportedFigures('Their capacity is 24 kt.', raw).length > 0);
});

test('the missing link is named: the buyers, not "the details"', async () => {
  const raw = `[producers_in] ${await call('producers_in', { country: 'Kazakhstan', resource: 'uranium' })}`;
  const gaps = missingLinks(KZ, [raw]);
  assert.deepEqual(
    gaps.map((g) => g.box),
    ['buyers'],
  );
  assert.equal(
    gaps[0].sentence,
    "The buyers of Kazakhstan's uranium output are not in our sources.",
  );
  assert.match(gaps[0].settles, /offtake/);
  assert.equal(gaps[0].entity, 'country:kz');
  // A graph result naming buyers (rung 3) closes it.
  assert.deepEqual(missingLinks(KZ, [raw, '[graph] {"buyers":[{"name":"x"}]}']), []);
});

test('a wall is caught: only a refusal, or a refusal of rows in hand', async () => {
  const raw = `[producers_in] ${await call('producers_in', { country: 'Kazakhstan', resource: 'uranium' })}`;
  assert.deepEqual(wallProblem(LIVE_WALL, [raw]), {
    kind: 'denies',
    what: ['facilities', 'owners'],
  });
  assert.deepEqual(wallProblem('That is not in our database.', [raw]), { kind: 'refusal-only' });
  const good =
    "Uranium in Kazakhstan is mined by joint ventures of NAC Kazatomprom JSC, e.g. JV Inkai LLP (NAC Kazatomprom JSC, 60%, and Cameco Corp., 40%). The buyers of these companies' output are not in our sources; offtake agreements in Kazatomprom's annual report would settle it.";
  assert.equal(wallProblem(good, [raw]), null);
  assert.equal(
    wallProblem('Not in the corpus.', ['[search_corpus] {"results":[]}']),
    null,
    'no rows, no wall to break',
  );
});

test('the web status is read in its four states', () => {
  assert.equal(webStatusOf(undefined), 'off');
  assert.equal(
    webStatusOf('[web_search] {"status":"could_not_look","error":"x"}'),
    'could_not_look',
  );
  assert.equal(webStatusOf('[web_search] {"status":"nothing","results":[]}'), 'nothing');
  assert.equal(webStatusOf('[web_search] {"status":"found","results":[{"title":"t"}]}'), 'found');
});

const done = (input: Parameters<typeof runAgent>[0]) =>
  new Promise<AgentAnswer>((resolve, reject) =>
    runAgent({
      ...input,
      emit: (e: AgentEvent) => {
        input.emit(e);
        if (e.type === 'done') resolve(e.data);
        if (e.type === 'error') reject(new Error(e.error));
      },
    }),
  );

test('the Kazakhstan question: web searched for the buyers, the wall sent back, the gap filed', async () => {
  const systems: string[] = [];
  const asks: string[] = [];
  let calls = 0;
  const turn: ModelTurn = async (input) => {
    calls++;
    systems.push(String(input.messages[0].content));
    asks.push(String(input.messages[input.messages.length - 1].content));
    return {
      text:
        calls === 1
          ? LIVE_WALL
          : "Uranium in Kazakhstan is mined by joint ventures, e.g. JV Inkai LLP (NAC Kazatomprom JSC, 60%, and Cameco Corp., 40%). The buyers of Kazakhstan's uranium output are not in our sources.",
      calls: [],
      model: 'groq/m',
    };
  };
  const searched: string[] = [];
  const filed: GapReport[] = [];
  const events: AgentEvent[] = [];
  const data = await done({
    question: KZ,
    history: [],
    context: readerContext({}),
    turn,
    env: {
      web: async (q) => {
        searched.push(q);
        return {
          status: 'found' as const,
          findings: [
            {
              title: 'Kazatomprom sales',
              url: 'https://example.org/kap',
              excerpt: 'Sold to utilities.',
            },
          ],
        };
      },
    },
    fileGap: (g) => {
      filed.push(g);
    },
    emit: (e) => events.push(e),
  });
  assert.deepEqual(searched, ['Kazakhstan uranium offtake buyers supply contracts']);
  assert.match(systems[0], /What the sources do not hold/);
  assert.match(systems[0], /The buyers of Kazakhstan's uranium output are not in our sources/);
  assert.match(systems[0], /unchecked leads \[W#\]/);
  assert.equal(calls, 2, 'the wall went back once');
  assert.match(asks[1], /the producers_in rows above carry them/);
  assert.match(data.answer, /JV Inkai LLP/);
  assert.equal(data.web.length, 1, 'the web passage travels as a lead, apart from the records');
  assert.deepEqual(filed, [
    { question: KZ, entity: 'country:kz', box: 'buyers', topics: ['uranium', 'kz', 'buyers'] },
  ]);
});

test('without a search backend the answer is told to say it could not look, not to go silent', async () => {
  let system = '';
  const turn: ModelTurn = async (input) => {
    system = String(input.messages[0].content);
    return { text: 'JV Inkai LLP is 60% NAC Kazatomprom JSC.', calls: [], model: 'groq/m' };
  };
  await done({
    question: KZ,
    history: [],
    context: readerContext({}),
    turn,
    env: {},
    emit: () => {},
  });
  assert.match(system, /I could not look this up on the web/);
});

test('the gap filer is one bindable seam that never throws', async () => {
  const seen: GapReport[] = [];
  const previous = setGapFiler((g) => {
    seen.push(g);
  });
  await fileGap({ question: 'q', topics: [] });
  setGapFiler(() => {
    throw new Error('storage down');
  });
  await fileGap({ question: 'q2', topics: [] });
  setGapFiler(previous);
  assert.deepEqual(seen, [{ question: 'q', topics: [] }]);
});

test('the prompt keeps every honesty rule and adds the ladder', () => {
  const prompt = systemPrompt({ context: readerContext({}), tools: [] });
  assert.match(prompt, /copy a quantity's `display` verbatim/);
  assert.match(prompt, /Never invent a number/);
  assert.match(prompt, /cite them as \[W1\], \[W2\]/);
  assert.match(prompt, /There is no wall/);
  assert.match(prompt, /never acceptable/);
  assert.match(prompt, /`companies` cell/);
});
