#!/usr/bin/env bash
# Install RevenueOSCore as a user LaunchAgent (survives closing the SwiftUI app).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPERATOR_DIR="$ROOT/services/operator"
ENTRY="$OPERATOR_DIR/dist/index.js"
LOG_DIR="${HOME}/Library/Logs/RevenueOS"
LAUNCH_AGENTS="${HOME}/Library/LaunchAgents"
PLIST_DST="${LAUNCH_AGENTS}/com.revenueos.core.plist"

mkdir -p "$LOG_DIR" "$LAUNCH_AGENTS"

if [[ ! -f "$OPERATOR_DIR/package.json" ]]; then
  echo "missing services/operator — abort"
  exit 1
fi

# Prefer built entry; fall back to tsx for Phase 1.
NODE="$(command -v node)"
if [[ -f "$ENTRY" ]]; then
  PROG_ENTRY="$ENTRY"
else
  TSX="$(command -v tsx || true)"
  if [[ -z "${TSX}" ]]; then
    echo "Build operator first: (cd services/operator && npm run build)"
    echo "Or: npm i -g tsx"
    exit 1
  fi
  NODE="$TSX"
  PROG_ENTRY="$OPERATOR_DIR/src/index.ts"
fi

# Load secrets from services/operator/.env into the plist EnvironmentVariables
# without printing values.
ENV_SNIPPET=""
if [[ -f "$OPERATOR_DIR/.env" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"
    case "$key" in
      SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|RESEND_API_KEY|SIDECAR_URL|SIDECAR_TOKEN|STRIPE_SECRET_KEY|BUSINESSES|CRON_SECRET|PORTFOLIO_PULSE_TOKEN)
        # Escape XML
        esc=$(printf '%s' "$val" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g')
        ENV_SNIPPET+="      <key>${key}</key><string>${esc}</string>"$'\n'
        ;;
    esac
  done < "$OPERATOR_DIR/.env"
fi

sed \
  -e "s|__NODE__|${NODE}|g" \
  -e "s|__OPERATOR_ENTRY__|${PROG_ENTRY}|g" \
  -e "s|__OPERATOR_DIR__|${OPERATOR_DIR}|g" \
  -e "s|__LOG_DIR__|${LOG_DIR}|g" \
  "$ROOT/macos/com.revenueos.core.plist.template" \
  | awk -v env="$ENV_SNIPPET" '
      /<\/dict>/ && !done {
        print env
        done=1
      }
      { print }
    ' > "$PLIST_DST.tmp"

# Insert env vars inside EnvironmentVariables dict more carefully
python3 - <<PY
from pathlib import Path
import re
root = Path("$ROOT")
template = (root / "macos/com.revenueos.core.plist.template").read_text()
node = """$NODE"""
entry = """$PROG_ENTRY"""
opdir = """$OPERATOR_DIR"""
logdir = """$LOG_DIR"""
template = (template
  .replace("__NODE__", node)
  .replace("__OPERATOR_ENTRY__", entry)
  .replace("__OPERATOR_DIR__", opdir)
  .replace("__LOG_DIR__", logdir))
env_block = """$ENV_SNIPPET"""
template = template.replace(
  "      <key>OPERATOR_NAME</key>\n      <string>mac-core</string>\n",
  "      <key>OPERATOR_NAME</key>\n      <string>mac-core</string>\n" + env_block,
)
Path("$PLIST_DST").write_text(template)
print("Wrote", "$PLIST_DST")
PY

rm -f "$PLIST_DST.tmp"
launchctl bootout "gui/$(id -u)/com.revenueos.core" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/com.revenueos.core"
launchctl kickstart -k "gui/$(id -u)/com.revenueos.core"
echo "RevenueOSCore installed. Logs: $LOG_DIR"
echo "Health: curl -s http://127.0.0.1:8080/status | head"
