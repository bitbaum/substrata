#!/usr/bin/env bash
# Move Substrata to substrata.ch; substrata.orangecat.ch keeps working as a
# path-preserving 308 redirect, so every old link still lands.
#
#   bash scripts/ops/move-to-substrata-ch.sh          # dry run: checks only
#   bash scripts/ops/move-to-substrata-ch.sh --go     # apply on the box
#
# Prerequisite (George, at Infomaniak): substrata.ch bought, and
#   A @   -> 167.233.22.31
#   A www -> 167.233.22.31
# Already done ahead of time: the OrangeCat OIDC client accepts both callbacks
# (orangecat#1207), and the host lives only in lib/site.ts (#131).
#
# Order matters. Caddy is only touched once DNS answers with the box, because
# Let's Encrypt rate-limits failed validations. AUTH_URL changes after Caddy
# serves the new host, so sign-in never points at an address that is not up.
# The lib/site.ts flip (canonical links, metadataBase) ships last as a PR.
set -euo pipefail

BOX=ubuntu@167.233.22.31
IP=167.233.22.31
NEW=substrata.ch
OLD=substrata.orangecat.ch
GO=${1:-}

say() { printf '%s\n' "$*"; }
fail() { say "✗ $*"; exit 1; }

for name in "$NEW" "www.$NEW"; do
  got=$(dig +short A "$name" @1.1.1.1 | tail -1)
  [ "$got" = "$IP" ] || fail "$name resolves to '${got:-nothing}', not $IP — add the A record at Infomaniak and retry"
  say "✓ $name -> $IP"
done

CADDY=$(cat <<EOF
$NEW {
	import access_log
	encode zstd gzip
	handle_path /uploads/* {
		root * /opt/substrata/uploads
		file_server
	}
	reverse_proxy 127.0.0.1:4022 {
		flush_interval -1
		# Re-dial across a restart instead of returning 502 the moment the
		# upstream refuses. Only the dial is retried, never a request.
		lb_try_duration 20s
		lb_try_interval 250ms
	}
}

www.$NEW {
	import access_log
	redir https://$NEW{uri} 308
}

# The first address. Kept alive as a redirect so every shared link lands;
# one canonical host, because sign-in cookies are per host.
$OLD {
	import access_log
	redir https://$NEW{uri} 308
}
EOF
)

if [ "$GO" != "--go" ]; then
  say "DNS is ready. Dry run — re-run with --go to apply. The Caddy file would be:"
  say "$CADDY"
  exit 0
fi

stamp=$(date +%Y%m%d-%H%M%S)
printf '%s\n' "$CADDY" | ssh "$BOX" "set -e
  f=/etc/caddy/apps.d/substrata.caddy
  sudo cp -p \$f /etc/caddy/substrata.caddy.bak-$stamp
  sudo tee \$f >/dev/null
  if ! sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    sudo cp -p /etc/caddy/substrata.caddy.bak-$stamp \$f
    echo 'caddy validate failed — restored the previous file' >&2; exit 1
  fi
  sudo systemctl reload caddy"
say "✓ Caddy serves $NEW; $OLD and www redirect (backup: /etc/caddy/substrata.caddy.bak-$stamp)"

for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$NEW/api/health" || true)
  [ "$code" = 200 ] && break
  sleep 4
done
[ "$code" = 200 ] || fail "https://$NEW/api/health answered $code after 2 min — check: journalctl -u caddy -n 50"
say "✓ https://$NEW/api/health 200"

ssh "$BOX" "set -e
  f=/opt/substrata/shared/.env
  sudo cp -p \$f \$f.bak-$stamp
  sudo sed -i 's|^AUTH_URL=.*|AUTH_URL=https://$NEW|' \$f
  sudo systemctl restart substrata-app"
say "✓ AUTH_URL=https://$NEW, substrata-app restarted"

for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$NEW/api/health" || true)
  [ "$code" = 200 ] && break
  sleep 2
done
[ "$code" = 200 ] || fail "app did not come back on $NEW ($code)"
old=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://$OLD/atlas?view=world")
say "✓ $OLD/atlas -> $old"
say ""
say "Last step: set SITE.host/url in lib/site.ts to $NEW (canonical links), merge, check sign-in."
