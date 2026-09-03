#!/usr/bin/env node
/**
 * Run one RevenueOS pursuit tick for a portfolio app (local operator).
 * Usage: node scripts/run-operator-tick.mjs raiseready
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const siteId = process.argv[2] || "raiseready";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const appDir = path.join(root, "apps", siteId);

// Load TR env for Stripe if present
try {
  const fs = await import("node:fs");
  const envPath = path.join(root, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
} catch {
  /* ignore */
}

process.env.NEXT_PUBLIC_APP_URL ??= `http://localhost:3011`;
process.env.REVENUEOS_LEDGER_DIR ??= path.join(appDir, ".data/revenueos");
process.chdir(appDir);

const require = createRequire(path.join(appDir, "package.json"));
// Use dynamic import via tsx registration — invoke as:
// npx tsx scripts/run-operator-tick.ts

console.error("Use: npx tsx scripts/run-operator-tick.ts <siteId>");
process.exit(1);
