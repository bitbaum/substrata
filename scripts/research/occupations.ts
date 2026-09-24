/**
 * Build research/occupations.json: what the official occupational records say
 * each role family needs.
 *
 *   curl -o /tmp/onet.zip https://www.onetcenter.org/dl_files/database/db_31_0_text.zip
 *   unzip /tmp/onet.zip -d /tmp/onet
 *   pnpm run research:occupations /tmp/onet/db_31_0_text
 *
 * Two public sources, named on every record so a reader can check it:
 *
 * - the O*NET 31.0 Database (US Department of Labor, CC BY 4.0) — for each
 *   O*NET-SOC code in config/careers-roles.ts: its description, job zone, the
 *   core tasks, the essential skills and knowledge areas rated most important, and the
 *   technology it lists as "hot";
 * - the ESCO API (European Commission) — for each ESCO occupation URI: its
 *   description and its essential skills.
 *
 * Nothing is edited by hand after this runs: re-run it to refresh.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROLE_FAMILIES } from '@/config/careers-roles';

const OUT = new URL('../../research/occupations.json', import.meta.url);
const ONET_VERSION = 'O*NET 31.0 Database';
const TOP_SKILLS = 8;
const TOP_KNOWLEDGE = 5;
const TOP_TECH = 8;
const TOP_ESCO = 14;
const TOP_TASKS = 4;

function rows(dir: string, file: string): string[][] {
  return readFileSync(join(dir, file), 'utf8')
    .split('\n')
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split('\t'));
}

/** Element names for one code, ranked by importance (scale IM), suppressed rows skipped. */
function ranked(table: string[][], code: string, limit: number): string[] {
  return table
    .filter((r) => r[0] === code && r[3] === 'IM' && r[9] !== 'Y')
    .sort((a, b) => Number(b[4]) - Number(a[4]))
    .slice(0, limit)
    .map((r) => r[2]);
}

/** The job zone and what O*NET says it takes to enter one, in O*NET's words. */
function zoneOf(zones: string[][], ref: Map<string, string[]>, code: string) {
  const zone = zones.find((z) => z[0] === code)?.[1];
  const r = zone ? ref.get(zone) : undefined;
  return r ? { zone: Number(zone), name: r[1], education: r[3], training: r[4] } : null;
}

async function esco(uri: string) {
  const url = `https://ec.europa.eu/esco/api/resource/occupation?uri=${encodeURIComponent(uri)}&language=en`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`ESCO ${uri}: ${response.status}`);
  const json = (await response.json()) as {
    title: string;
    code?: string;
    description?: { en?: { literal?: string } };
    _links?: { hasEssentialSkill?: { title: string }[] };
  };
  return {
    uri,
    title: json.title,
    iscoCode: json.code ?? null,
    description: json.description?.en?.literal ?? '',
    essentialSkills: (json._links?.hasEssentialSkill ?? []).slice(0, TOP_ESCO).map((s) => s.title),
    url: `https://esco.ec.europa.eu/en/classification/occupation?uri=${encodeURIComponent(uri)}`,
  };
}

async function main() {
  const dir = process.argv.slice(2).find((a) => a !== '--');
  if (!dir) throw new Error('Pass the unzipped O*NET text directory.');
  const data = rows(dir, 'Occupation Data.txt');
  const skills = [...rows(dir, 'Essential Skills.txt'), ...rows(dir, 'Transferable Skills.txt')];
  const knowledge = rows(dir, 'Knowledge.txt');
  const zones = rows(dir, 'Job Zones.txt');
  const zoneRef = new Map(rows(dir, 'Job Zone Reference.txt').map((r) => [r[0], r]));
  const software = rows(dir, 'Software Skills.txt');
  const tasks = rows(dir, 'Task Statements.txt');
  const taskImportance = new Map(
    rows(dir, 'Task Ratings.txt')
      .filter((r) => r[2] === 'IM')
      .map((r) => [`${r[0]}|${r[1]}`, Number(r[4])]),
  );
  const topTasks = (code: string) =>
    tasks
      .filter((t) => t[0] === code && t[3] === 'Core')
      .sort(
        (a, b) =>
          (taskImportance.get(`${code}|${b[1]}`) ?? 0) -
          (taskImportance.get(`${code}|${a[1]}`) ?? 0),
      )
      .slice(0, TOP_TASKS)
      .map((t) => t[2]);

  const onet: Record<string, unknown> = {};
  const escoOut: Record<string, unknown> = {};
  for (const family of ROLE_FAMILIES) {
    for (const occ of family.occupations) {
      if (occ.onet && !onet[occ.onet]) {
        const row = data.find((r) => r[0] === occ.onet);
        if (!row) throw new Error(`O*NET code ${occ.onet} not in ${ONET_VERSION}`);
        onet[occ.onet] = {
          code: occ.onet,
          title: row[1],
          description: row[2],
          jobZone: zoneOf(zones, zoneRef, occ.onet),
          tasks: topTasks(occ.onet),
          skills: ranked(skills, occ.onet, TOP_SKILLS),
          knowledge: ranked(knowledge, occ.onet, TOP_KNOWLEDGE),
          hotTechnology: [
            ...new Set(software.filter((s) => s[0] === occ.onet && s[4] === 'Y').map((s) => s[1])),
          ].slice(0, TOP_TECH),
          url: `https://www.onetonline.org/link/summary/${occ.onet}`,
        };
      }
      if (occ.esco && !escoOut[occ.esco]) {
        escoOut[occ.esco] = await esco(occ.esco);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  const file = {
    version: 1,
    generatedOn: new Date().toISOString().slice(0, 10),
    sources: {
      onet: {
        name: ONET_VERSION,
        url: 'https://www.onetcenter.org/database.html',
        license:
          'O*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license.',
      },
      esco: {
        name: 'ESCO API, European Commission',
        url: 'https://esco.ec.europa.eu/en/use-esco/use-esco-services-api',
      },
    },
    onet,
    esco: escoOut,
  };
  writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`);
  console.log(
    `occupations: ${Object.keys(onet).length} O*NET, ${Object.keys(escoOut).length} ESCO`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
