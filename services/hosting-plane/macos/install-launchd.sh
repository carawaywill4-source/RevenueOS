#!/usr/bin/env bash
# Install hosting plane as LaunchAgent (survives Terminal/Cursor quit).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HP="$ROOT/services/hosting-plane"
HOME_DIR="${HOME}"
LABEL="com.revenueos.hosting"
PLIST_SRC="$HP/macos/com.revenueos.hosting.plist"
PLIST_DST="$HOME_DIR/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME_DIR/Library/Logs/RevenueOS"

mkdir -p "$LOG_DIR" "$HOME_DIR/Library/LaunchAgents"

NODE="$(command -v node)"
TSX="$ROOT/node_modules/.bin/tsx"
INDEX="$HP/src/index.ts"
if [[ ! -x "$TSX" ]]; then
  echo "Missing $TSX — run npm install at repo root first" >&2
  exit 1
fi

if lsof -tiTCP:8090 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Stopping existing process on :8090…"
  kill "$(lsof -tiTCP:8090 -sTCP:LISTEN)" 2>/dev/null || true
  sleep 1
fi

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true

PATH_VAL="$(dirname "$NODE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

sed \
  -e "s|__NODE__|${NODE}|g" \
  -e "s|__TSX__|${TSX}|g" \
  -e "s|__INDEX__|${INDEX}|g" \
  -e "s|__HOSTING_DIR__|${HP}|g" \
  -e "s|__PATH__|${PATH_VAL}|g" \
  -e "s|__HOME__|${HOME_DIR}|g" \
  -e "s|__REPO__|${ROOT}|g" \
  "$PLIST_SRC" > "$PLIST_DST"

launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/${LABEL}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed LaunchAgent: $PLIST_DST"
for i in $(seq 1 30); do
  if curl -fsS --max-time 1 http://127.0.0.1:8090/healthz >/dev/null 2>&1; then
    echo "Hosting plane healthy on :8090"
    curl -fsS http://127.0.0.1:8090/healthz
    echo
    exit 0
  fi
  sleep 1
done
echo "WARN: hosting not healthy — check $LOG_DIR/hosting.stderr.log" >&2
exit 1
