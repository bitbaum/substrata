"""Run as root on bitbaum. Idempotently provision Substrata's research service.

Secrets stay on the host. Existing credentials are retained. No destructive SQL.
Usage: python3 provision-service.py /path/to/001-research-service.sql
"""
import hashlib
import os
from pathlib import Path
import secrets
import subprocess
import sys
from urllib.parse import urlsplit


def sql(database, statement, docker=False):
    command = (["docker", "exec", "-i", "supabase-db", "psql", "-U", "postgres"]
               if docker else ["sudo", "-u", "postgres", "psql"])
    result = subprocess.run(command + ["-d", database, "-v", "ON_ERROR_STOP=1", "-At"],
                            input=statement, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError("Database operation failed; inspect server logs (SQL withheld to protect credentials)")
    return result.stdout.strip()


def env_values(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('"').strip("'")
    return values


env_path = Path('/opt/substrata/shared/.env')
previous = env_path.read_text()
env = env_values(env_path)
reference = env_values('/opt/loki/app/.env')
if 'DATABASE_URL' not in env:
    if sql('postgres', "SELECT 1 FROM pg_roles WHERE rolname='substrata'"):
        raise RuntimeError('Existing role without configured credentials; reconcile before continuing')
    password = secrets.token_urlsafe(36)
    sql('postgres', f"CREATE ROLE substrata LOGIN PASSWORD '{password}';")
    sql('postgres', 'CREATE DATABASE substrata OWNER substrata;')
    env['DATABASE_URL'] = f'postgresql://substrata:{password}@127.0.0.1:5432/substrata'
env.setdefault('AUTH_SECRET', secrets.token_urlsafe(48))
env['AUTH_URL'] = 'https://substrata.orangecat.ch'
env['AUTH_TRUST_HOST'] = 'true'
env['ORANGECAT_OAUTH_CLIENT_ID'] = 'substrata'
existing_client = sql('postgres', "SELECT 1 FROM public.oauth_clients WHERE client_id='substrata'", True)
if existing_client and 'ORANGECAT_OAUTH_CLIENT_SECRET' not in env:
    raise RuntimeError('Existing OAuth client without secret; refuse implicit rotation')
env.setdefault('ORANGECAT_OAUTH_CLIENT_SECRET', secrets.token_urlsafe(36))
hashed = hashlib.sha256(env['ORANGECAT_OAUTH_CLIENT_SECRET'].encode()).hexdigest()
sql('postgres', f"""INSERT INTO public.oauth_clients(client_id,name,client_secret_hash,redirect_uris,allowed_scopes,is_confidential,is_trusted)
VALUES('substrata','Substrata','{hashed}',ARRAY['https://substrata.orangecat.ch/api/auth/callback/orangecat'],ARRAY['openid','profile','email'],true,false)
ON CONFLICT(client_id) DO UPDATE SET name=EXCLUDED.name,redirect_uris=EXCLUDED.redirect_uris,allowed_scopes=EXCLUDED.allowed_scopes;""", True)
for key in ('GROQ_API_KEY', 'OPENROUTER_API_KEY'):
    if reference.get(key):
        env.setdefault(key, reference[key])
owner_actor = sql('loki', "SELECT orangecat_actor_id FROM users WHERE id='00000000-0000-0000-0000-000000000001'")
if not owner_actor:
    raise RuntimeError('Owner has no linked OrangeCat actor')
env['SUBSTRATA_REVIEWER_ACTOR_IDS'] = owner_actor
backup = env_path.with_name('.env.before-research-service')
if not backup.exists():
    backup.write_text(previous)
    backup.chmod(0o600)
env_path.write_text('# Substrata research service. Runtime environment source of truth.\n' + '\n'.join(f'{k}={v}' for k, v in env.items()) + '\n')
env_path.chmod(0o640)
import pwd
owner = pwd.getpwnam('ubuntu')
os.chown(env_path, owner.pw_uid, owner.pw_gid)
sql('substrata', 'SET ROLE substrata;\n' + Path(sys.argv[1]).read_text())
# The host rejects every database/role pair not explicitly allowlisted.
# Test through TCP as the app, not through the postgres operator connection.
hba = Path(sql('postgres', 'SHOW hba_file;'))
rules = hba.read_text()
rule = 'host substrata substrata 127.0.0.1/32 scram-sha-256'
if rule not in rules:
    hba_backup = hba.with_name('pg_hba.conf.before-substrata')
    if not hba_backup.exists():
        hba_backup.write_text(rules)
        hba_backup.chmod(0o600)
    hba.write_text('# Substrata app role: localhost, own database only.\n' + rule + '\n' + rules)
    if sql('postgres', 'SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;') != '0':
        hba.write_text(rules)
        raise RuntimeError('Invalid HBA configuration; restored previous rules')
    sql('postgres', 'SELECT pg_reload_conf();')
probe_env = dict(os.environ, PGPASSWORD=urlsplit(env['DATABASE_URL']).password)
probe = subprocess.run(['psql', '-h', '127.0.0.1', '-U', 'substrata', '-d', 'substrata', '-Atc', 'SELECT 1'], env=probe_env, capture_output=True, text=True)
if probe.returncode or probe.stdout.strip() != '1':
    raise RuntimeError('Runtime database login failed')
print('Substrata database, schema, identity client, reviewer and AI providers configured; no credentials printed.')
