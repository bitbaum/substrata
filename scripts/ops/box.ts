/**
 * How the deploy talks to the box. Three runners, one shape each:
 *
 *   sshPsql   SQL on stdin → `sudo -u postgres psql -d <db>` on the box, over ssh as
 *             ubuntu. The same door Loki's apply-schema.sh uses for host databases.
 *   sshRemote a fixed shell command (plus optional stdin) on the box, as ubuntu.
 *   localPsql SQL on stdin → a psql against a URL. Only for tests against a scratch
 *             Postgres; production never uses it.
 *
 * Nothing here logs its input: SQL and unit files travel on stdin, never in argv,
 * and failures report psql's/ssh's own message, not the statement.
 */
import { spawn } from 'node:child_process';

export type SqlRunner = (sql: string) => Promise<string>;
export type Remote = (command: string, stdin?: string) => Promise<string>;

const SSH = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15'];
const PSQL = ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'];
const IDENT = /^[a-z_][a-z0-9_]*$/;

function run(cmd: string, args: string[], stdin: string, env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve(out.trim());
      reject(new Error(`${cmd} exited ${code}: ${err.trim().slice(0, 1500)}`));
    });
    child.stdin.on('error', () => undefined); // the exit code carries the failure
    child.stdin.end(stdin);
  });
}

export function sshPsql(box: string, database: string): SqlRunner {
  if (!/^[a-z][a-z0-9_-]*@[A-Za-z0-9.-]+$/.test(box)) throw new Error('box must be user@host');
  if (!IDENT.test(database)) throw new Error('database must be a plain identifier');
  return (sql) =>
    run(
      'ssh',
      [...SSH, box, `LC_ALL=C sudo -u postgres psql -d ${database} ${PSQL.join(' ')}`],
      sql,
    );
}

export function sshRemote(box: string): Remote {
  if (!/^[a-z][a-z0-9_-]*@[A-Za-z0-9.-]+$/.test(box)) throw new Error('box must be user@host');
  return (command, stdin = '') => run('ssh', [...SSH, box, command], stdin);
}

export function localPsql(url: string): SqlRunner {
  return (sql) => run('psql', [url, ...PSQL], sql);
}
