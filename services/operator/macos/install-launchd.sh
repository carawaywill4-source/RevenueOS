#!/usr/bin/env bash
# Install RevenueOSCore as a macOS LaunchAgent (survives Terminal/Cursor quit + reboot).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OP="$ROOT/services/operator"
HOME_DIR="${HOME}"
LABEL="com.revenueos.core"
PLIST_SRC="$OP/macos/com.revenueos.core.plist"
PLIST_DST="$HOME_DIR/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME_DIR/Library/Logs/RevenueOS"

mkdir -p "$LOG_DIR" "$HOME_DIR/Library/LaunchAgents"

NODE="$(command -v node)"
TSX="$ROOT/node_modules/.bin/tsx"
INDEX="$OP/src/index.ts"
if [[ ! -x "$TSX" ]]; then
  echo "Missing $TSX — run npm install at repo root first" >&2
  exit 1
fi
if [[ ! -f "$OP/.env" ]]; then
  echo "Missing $OP/.env" >&2
  exit 1
fi

# Stop any ad-hoc Core on :8080 so launchd owns the port.
if lsof -tiTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Stopping existing process on :8080…"
  kill "$(lsof -tiTCP:8080 -sTCP:LISTEN)" 2>/dev/null || true
  sleep 2
  if lsof -tiTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
    kill -9 "$(lsof -tiTCP:8080 -sTCP:LISTEN)" 2>/dev/null || true
    sleep 1
  fi
fi

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true

PATH_VAL="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/$(basename "$(dirname "$(dirname "$NODE")")")/bin:/usr/bin:/bin"
# Prefer actual node dir on PATH
PATH_VAL="$(dirname "$NODE"):$PATH_VAL"

sed \
  -e "s|__NODE__|${NODE}|g" \
  -e "s|__TSX__|${TSX}|g" \
  -e "s|__INDEX__|${INDEX}|g" \
  -e "s|__OPERATOR_DIR__|${OP}|g" \
  -e "s|__PATH__|${PATH_VAL}|g" \
  -e "s|__HOME__|${HOME_DIR}|g" \
  "$PLIST_SRC" > "$PLIST_DST"

launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/${LABEL}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed LaunchAgent: $PLIST_DST"
echo "Logs: $LOG_DIR/core.stdout.log"
for i in $(seq 1 30); do
  if curl -fsS --max-time 1 http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
    echo "RevenueOSCore healthy on :8080"
    curl -fsS http://127.0.0.1:8080/status | head -c 400
    echo
    exit 0
  fi
  sleep 1
done
echo "WARN: Core not healthy yet — check $LOG_DIR/core.stderr.log" >&2
exit 1
