#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  "$ROOT/packages/revenueos/" \
  "$ROOT/apps/mendhaus/vendor/revenueos/"
echo "Synced packages/revenueos → apps/mendhaus/vendor/revenueos"
