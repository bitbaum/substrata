/**
 * Which adapter can work on which dossier task, and how to run it. The task
 * (lib/dossier/tasks.ts) names a subject and a box; an adapter applies when
 * its source is on the box's allowed list in spirit — a registry or filing
 * family the box names — and it can find the subject in that source without
 * guessing. When it cannot (no LEI, no QID, two CIKs), the plan says what to
 * pass instead of picking one.
 */
import { resourcesFor } from '@/config/substrata-resources';
import type { RelationCandidate } from '@/lib/entry/candidate';
import type { DossierTask } from '@/lib/dossier/tasks';
import { allRelations, isCounted } from '@/lib/graph/index';
import { HS_FOR_RESOURCE, runComtrade } from './comtrade';
import type { DocumentDeps } from './document';
import { findCik, runEdgar } from './edgar';
import { runGleif } from './gleif';
import { KAP_ENDPOINT, runKazatomprom } from './kazatomprom';
import { adapterRun, type AdapterResult } from './proposal';
import { edgeKey, runWikidata } from './wikidata';

export interface RunOptions {
  runId: string;
  /** GLEIF: the subject's LEI (search with `--find-lei`). */
  lei?: string;
  /** Wikidata: the subject's item id. */
  qid?: string;
  /** EDGAR: the filer's CIK, when its name or ticker matches more than one. */
  cik?: number;
  /** Comtrade: an HS code and a year, instead of the country's resources and two years back. */
  hs?: string;
  period?: string;
  /** Comtrade: how many partners, largest first (default 5). */
  top?: number;
  deps?: DocumentDeps;
}

export interface AdapterPlan {
  adapter: string;
  /** What it reads, in the words of the box's source list. */
  reads: string;
  /** Present when it can run; absent with `needs` when the caller must say more. */
  run?: (agrees: (key: string) => boolean) => Promise<AdapterResult>;
  needs?: string;
}

const COMPANY_OWNERS = new Set(['owners']);
const COMPANY_TRADE = new Set(['customers', 'suppliers', 'owners']);

export function plansFor(task: DossierTask, opts: RunOptions): AdapterPlan[] {
  const by = (name: string) => adapterRun(name, opts.runId);
  const deps = opts.deps ?? {};
  const plans: AdapterPlan[] = [];
  const iso2 = task.kind === 'country' ? task.entity.slice('country:'.length) : null;

  if (iso2 && task.box === 'trade') {
    const resources = (resourcesFor(iso2)?.resources ?? []).filter((r) => HS_FOR_RESOURCE[r]);
    const codes = opts.hs ? [opts.hs] : resources.map((r) => HS_FOR_RESOURCE[r].code);
    const period = opts.period ?? String(new Date().getFullYear() - 2);
    if (!codes.length)
      plans.push({
        adapter: 'comtrade',
        reads: 'UN Comtrade',
        needs: 'no HS code is mapped for this country’s resources; pass --hs <code>',
      });
    for (const hs of codes)
      plans.push({
        adapter: 'comtrade',
        reads: `UN Comtrade, exports of HS ${hs}, ${period}`,
        run: () =>
          runComtrade({ reporterIso2: iso2, hs, period, top: opts.top }, by('comtrade'), deps),
      });
  }
  if (
    (task.entity === 'country:kz' && task.box === 'trade') ||
    (task.entity === KAP_ENDPOINT && COMPANY_TRADE.has(task.box))
  )
    plans.push({
      adapter: 'kazatomprom',
      reads:
        'company offtake or sales disclosure: Kazatomprom annual report and trading update (PDF)',
      run: () => runKazatomprom(by('kazatomprom'), {}, deps),
    });

  if (task.kind === 'company') {
    if (COMPANY_OWNERS.has(task.box)) {
      plans.push(
        opts.lei
          ? {
              adapter: 'gleif',
              reads: 'GLEIF LEI record',
              run: () => runGleif(opts.lei!, by('gleif'), { subject: task.entity }, deps),
            }
          : {
              adapter: 'gleif',
              reads: 'GLEIF LEI record',
              needs: `pass --lei <LEI>; list candidates with --find-lei "${task.name}"`,
            },
        opts.qid
          ? {
              adapter: 'wikidata',
              reads: 'Wikidata (lead unless a second source agrees)',
              run: (agrees) =>
                runWikidata(opts.qid!, by('wikidata'), { subject: task.entity, agrees }, deps),
            }
          : {
              adapter: 'wikidata',
              reads: 'Wikidata',
              needs: `pass --qid <Q…>; list candidates with --find-qid "${task.name}"`,
            },
      );
    }
    if (COMPANY_TRADE.has(task.box))
      plans.push({
        adapter: 'edgar',
        reads: 'SEC EDGAR: 10-K/20-F customers, DEF 14A 5% holders',
        run: async () => {
          const ciks = opts.cik ? [opts.cik] : await findCik(task.name, deps);
          if (ciks.length !== 1)
            return {
              adapter: 'edgar',
              records: [],
              rows: [],
              skipped: [
                {
                  record: task.name,
                  reason: ciks.length
                    ? `names ${ciks.length} SEC filers (${ciks.join(', ')}); pass --cik`
                    : 'no SEC filer by that name; pass --cik if it files under another',
                },
              ],
            };
          return runEdgar(ciks[0], task.entity, by('edgar'), deps);
        },
      });
  }
  return plans;
}

/** Does `row` fill this task's box (the box's relation queries), or only sit near it? */
export function countsFor(
  task: DossierTask,
  row: RelationCandidate,
  queries: readonly { types: readonly string[]; direction: 'out' | 'in' }[],
): boolean {
  return queries.some(
    (q) =>
      q.types.includes(row.type) && (q.direction === 'out' ? row.from : row.to) === task.entity,
  );
}

/**
 * Run every runnable plan in order. Wikidata runs last and may read `stated`
 * only where a counted graph relation or another adapter's stated row agrees.
 */
export async function runPlans(plans: readonly AdapterPlan[]): Promise<AdapterResult[]> {
  const counted = new Set(
    allRelations()
      .filter(isCounted)
      .map((r) => edgeKey(r.from, r.type, r.to)),
  );
  const results: AdapterResult[] = [];
  const ordered = [
    ...plans.filter((p) => p.adapter !== 'wikidata'),
    ...plans.filter((p) => p.adapter === 'wikidata'),
  ];
  for (const plan of ordered) {
    if (!plan.run) continue;
    const stated = new Set(
      results.flatMap((r) =>
        r.rows.filter((x) => x.grade === 'stated').map((x) => edgeKey(x.from, x.type, x.to)),
      ),
    );
    try {
      results.push(await plan.run((key) => counted.has(key) || stated.has(key)));
    } catch (error) {
      results.push({
        adapter: plan.adapter,
        records: [],
        rows: [],
        skipped: [{ record: plan.reads, reason: (error as Error).message }],
      });
    }
  }
  return results;
}
