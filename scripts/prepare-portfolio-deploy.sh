#!/usr/bin/env bash
# Vendor @revenueos/core + storefront-kit into a portfolio app for Vercel.
set -euo pipefail
SITE="${1:?siteId required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/$SITE"
# Ensure destination parents exist — rsync mkdir can fail on fresh apps.
mkdir -p "$APP/vendor/revenueos" "$APP/vendor/storefront-kit"
rsync -a --delete --exclude node_modules --exclude .git \
  "$ROOT/packages/revenueos/" "$APP/vendor/revenueos/"
rsync -a --delete --exclude node_modules --exclude .git \
  "$ROOT/packages/storefront-kit/" "$APP/vendor/storefront-kit/"
node -e "
const fs=require('fs');
const pkg=JSON.parse(fs.readFileSync('$APP/package.json','utf8'));
pkg.dependencies['@revenueos/core']='file:./vendor/revenueos';
pkg.dependencies['@revenueos/storefront-kit']='file:./vendor/storefront-kit';
fs.writeFileSync('$APP/package.json', JSON.stringify(pkg,null,2)+'\\n');
const ts=JSON.parse(fs.readFileSync('$APP/tsconfig.json','utf8'));
ts.compilerOptions.paths={
  '@/*':['./src/*'],
  '@revenueos/core':['./vendor/revenueos/src/index.ts'],
  '@revenueos/storefront-kit':['./vendor/storefront-kit/src/index.ts'],
};
fs.writeFileSync('$APP/tsconfig.json', JSON.stringify(ts,null,2)+'\\n');
"
echo "Prepared $SITE for deploy"
