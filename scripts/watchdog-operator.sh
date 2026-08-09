#!/usr/bin/env bash
# Restart keep-operating.mjs if it dies. Run forever.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p .data
LOG=.data/watchdog.log
while true; do
  if ! pgrep -f 'node scripts/keep-operating.mjs' >/dev/null 2>&1; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] restarting keep-operating" | tee -a "$LOG"
    nohup node scripts/keep-operating.mjs >> .data/keep-operating.stdout 2>&1 &
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] pid=$!" | tee -a "$LOG"
  fi
  sleep 60
done
