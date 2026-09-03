#!/usr/bin/env node
/**
 * Prepare Batch 1 Mac cutover targets (beyond RaiseReady):
 *   - sync live Supabase creds to Vercel production
 *   - vendor + deploy with document claims + /api/owner/execute
 *
 *   node scripts/prepare-batch1-cutover.mjs resumeforge depositproof
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const sites = process.argv.slice(2);
if (!sites.length) {
  console.error("Usage: node scripts/prepare-batch1-cutover.mjs <siteId>...");
  process.exit(2);
}

function parse(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    let v = s.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[s.slice(0, i).trim()] = v;
  }
  return out;
}

const local = parse(path.join(ROOT, ".env.local"));
const url = local.SUPABASE_URL;
const key = local.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_* in .env.local");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
console.log(JSON.stringify({ liveProjectRef: ref, sites }));

function sh(cmd, args, cwd, input) {
  const r = spawnSync(cmd, args, {
    cwd,
    input,
    encoding: "utf8",
    stdio: input !== undefined ? ["pipe", "pipe", "pipe"] : "inherit",
  });
  if (r.status !== 0) {
    console.error(cmd, args.join(" "), "failed", r.status);
    console.error((r.stderr || "").slice(0, 400));
    process.exit(r.status ?? 1);
  }
  return r;
}

function upsertEnv(appDir, name, value) {
  spawnSync("vercel", ["env", "rm", name, "production", "--yes"], {
    cwd: appDir,
    encoding: "utf8",
  });
  sh("vercel", ["env", "add", name, "production"], appDir, value + "\n");
}

for (const site of sites) {
  const appDir = path.join(ROOT, "apps", site);
  if (!existsSync(appDir)) {
    console.error("missing app", site);
    process.exit(1);
  }
  console.log("--- prepare", site);
  sh("bash", [path.join(ROOT, "scripts/prepare-portfolio-deploy.sh"), site], ROOT);
  upsertEnv(appDir, "SUPABASE_URL", url);
  upsertEnv(appDir, "SUPABASE_SERVICE_ROLE_KEY", key);
  console.log("--- deploy", site);
  sh("vercel", ["--prod", "--yes"], appDir);
  console.log("OK", site);
}

console.log(JSON.stringify({ prepared: sites, projectRef: ref }));
