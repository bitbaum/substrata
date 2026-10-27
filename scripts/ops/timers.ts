/**
 * Substrata's systemd units, from files in deploy/systemd/.
 *
 * The files are the source of truth. The deploy copies the ones that differ to
 * /etc/systemd/system, reloads systemd and enables each timer, as ubuntu with
 * passwordless sudo (the same door deploy.sh restarts the app through).
 *
 * Because the repo can thereby write root-owned files, nothing is accepted that is
 * not exactly the shape of an appcron unit: a fixed name pattern, a fixed set of
 * keys, and an ExecStart that can only be /opt/_appcron/run.sh calling a
 * /api/cron/<job> route of this app on its own port. Anything else fails the deploy
 * before a byte is written.
 */
import type { Remote } from './box';

export const APP = 'substrata';
export const PORT = 4022;
const UNIT_DIR = '/etc/systemd/system';
const RUNNER = '/opt/_appcron/run.sh';

export interface UnitFile {
  name: string;
  text: string;
}

const ALLOWED: Record<string, string[]> = {
  Unit: ['Description', 'After', 'Wants', 'OnFailure'],
  Service: ['Type', 'ExecStart'],
  Timer: ['OnCalendar', 'RandomizedDelaySec', 'Persistent', 'Unit'],
  Install: ['WantedBy'],
};
const NAME = new RegExp(`^appcron-${APP}-[a-z0-9-]+\\.(service|timer)$`);
const EXEC = new RegExp(
  `^${RUNNER.replace(/\./g, '\\.')} ${APP} ${PORT} /api/cron/[a-z0-9-]+ (GET|POST)$`,
);
const CALENDAR = /^[A-Za-z0-9 :*,/.\-]+$/;

export function validateUnit(unit: UnitFile): string[] {
  const problems: string[] = [];
  const fail = (why: string) => problems.push(`${unit.name}: ${why}`);
  if (!NAME.test(unit.name))
    return [`${unit.name}: name must be appcron-${APP}-<job>.service|timer`];
  let section = '';
  const seen: Record<string, string> = {};
  for (const raw of unit.text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const head = line.match(/^\[(\w+)\]$/);
    if (head) {
      section = head[1];
      if (!ALLOWED[section]) fail(`section [${section}] is not allowed`);
      continue;
    }
    const kv = line.match(/^(\w+)=(.*)$/);
    if (!kv || !ALLOWED[section]?.includes(kv[1])) {
      fail(`line not allowed in [${section}]: ${line.slice(0, 60)}`);
      continue;
    }
    seen[`${section}.${kv[1]}`] = kv[2];
  }
  const service = unit.name.endsWith('.service');
  if (service) {
    if (seen['Service.Type'] !== 'oneshot') fail('Type must be oneshot');
    if (!EXEC.test(seen['Service.ExecStart'] ?? ''))
      fail(`ExecStart must be "${RUNNER} ${APP} ${PORT} /api/cron/<job> GET|POST"`);
    if (seen['Unit.OnFailure'] && seen['Unit.OnFailure'] !== 'notify-failure@%n.service')
      fail('OnFailure must be notify-failure@%n.service');
  } else {
    const stem = unit.name.replace(/\.timer$/, '');
    if (seen['Timer.Unit'] !== `${stem}.service`) fail(`Unit must be ${stem}.service`);
    if (!CALENDAR.test(seen['Timer.OnCalendar'] ?? '')) fail('OnCalendar missing or odd');
    if (seen['Install.WantedBy'] !== 'timers.target') fail('WantedBy must be timers.target');
  }
  return problems;
}

/** Pairs, and only pairs: a timer needs its service and a service needs its timer. */
export function validateSet(units: UnitFile[]): string[] {
  const problems = units.flatMap(validateUnit);
  const names = new Set(units.map((u) => u.name));
  for (const u of units) {
    const stem = u.name.replace(/\.(service|timer)$/, '');
    const other = u.name.endsWith('.timer') ? `${stem}.service` : `${stem}.timer`;
    if (!names.has(other)) problems.push(`${u.name}: ${other} is missing beside it`);
  }
  return problems;
}

export interface UnitChange {
  name: string;
  state: 'new' | 'changed' | 'same';
}

export async function planUnits(remote: Remote, units: UnitFile[]): Promise<UnitChange[]> {
  const changes: UnitChange[] = [];
  for (const u of units) {
    const path = `${UNIT_DIR}/${u.name}`;
    const got = await remote(`if [ -f '${path}' ]; then echo present; cat '${path}'; fi`);
    const state = !got
      ? 'new'
      : got.replace(/^present\n?/, '').trim() === u.text.trim()
        ? 'same'
        : 'changed';
    changes.push({ name: u.name, state });
  }
  return changes;
}

export async function installUnits(
  remote: Remote,
  units: UnitFile[],
  changes: UnitChange[],
  log: (line: string) => void,
): Promise<void> {
  await remote(`test -x ${RUNNER}`).catch(() => {
    throw new Error(`${RUNNER} is missing on the box; Loki's install-app-crons.sh creates it`);
  });
  for (const c of changes) {
    if (c.state === 'same') continue;
    const unit = units.find((u) => u.name === c.name)!;
    const path = `${UNIT_DIR}/${unit.name}`;
    await remote(`sudo tee '${path}' >/dev/null && sudo chmod 644 '${path}'`, unit.text);
    log(`wrote ${unit.name} (${c.state})`);
  }
  if (changes.some((c) => c.state !== 'same')) {
    await remote('sudo systemctl daemon-reload');
    log('systemd reloaded');
  }
  // Every deploy, changed or not: a timer someone stopped by hand comes back.
  for (const u of units.filter((x) => x.name.endsWith('.timer'))) {
    await remote(`sudo systemctl enable --now '${u.name}'`);
    log(`enabled ${u.name}`);
  }
  for (const u of units.filter((x) => x.name.endsWith('.timer'))) {
    log(
      (await remote(`systemctl list-timers '${u.name}' --all --no-pager`))
        .split('\n')
        .slice(0, 2)
        .join(' | '),
    );
  }
}
