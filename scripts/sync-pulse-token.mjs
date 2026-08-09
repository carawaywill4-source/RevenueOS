#!/usr/bin/env node
/**
 * Targeted sync — push ONLY the portfolio-wide pulse auth (CRON_SECRET +
 * PORTFOLIO_PULSE_TOKEN) to every portfolio app AND to the TR root project.
 *
 * The full `sync-portfolio-envs.mjs` walks every SHARED_KEY across every site
 * and is slow enough to time out during an interactive fix. This script exists
 * so a single 401-on-pulse regression can be resolved in seconds instead of
 * re-writing 50 keys × 10 sites × 2 vercel calls.
 *
 * Usage: node scripts/sync-pulse-token.mjs [--env production|preview]
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

const PORTFOLIO_SITES = [
  "raiseready",
  "ledgerleaf",
  "depositproof",
  "turnoverkit",
  "listinglift",
  "closeshift",
  "bidbinder",
  "resumeforge",
  "waitroom",
  "shopbeacon",
];

const KEYS = ["CRON_SECRET", "PORTFOLIO_PULSE_TOKEN"];

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[s.slice(0, i).trim()] = v;
  }
  return out;
}

function vercel(args, cwd, stdin) {
  const res = spawnSync("vercel", args, { cwd, input: stdin, encoding: "utf8" });
  return { ok: res.status === 0, stderr: res.stderr ?? "" };
}

function upsert(cwd, key, value, envName) {
  vercel(["env", "rm", key, envName, "-y"], cwd);
  return vercel(["env", "add", key, envName], cwd, value).ok;
}

const envIdx = process.argv.indexOf("--env");
const envName = envIdx >= 0 ? process.argv[envIdx + 1] : "production";

const canonical = parseEnvFile(resolve(REPO, ".env.portfolio"));
if (!canonical.CRON_SECRET) {
  console.error("missing CRON_SECRET in .env.portfolio");
  process.exit(1);
}
if (!canonical.PORTFOLIO_PULSE_TOKEN) {
  canonical.PORTFOLIO_PULSE_TOKEN = canonical.CRON_SECRET;
  console.log("PORTFOLIO_PULSE_TOKEN defaulting to CRON_SECRET");
}

console.log(`Pushing ${KEYS.join(", ")} to ${PORTFOLIO_SITES.length} sites + TR (${envName}):`);
for (const site of PORTFOLIO_SITES) {
  const cwd = resolve(REPO, "apps", site);
  if (!existsSync(cwd)) {
    console.log(`  ${site}: SKIP (missing dir)`);
    continue;
  }
  const results = KEYS.map((k) => `${upsert(cwd, k, canonical[k], envName) ? "+" : "!"}${k}`);
  console.log(`  ${site}: ${results.join(" ")}`);
}
if (existsSync(resolve(REPO, ".vercel"))) {
  const results = KEYS.map((k) => `${upsert(REPO, k, canonical[k], envName) ? "+" : "!"}${k}`);
  console.log(`  tributeready (root): ${results.join(" ")}`);
} else {
  console.log(`  tributeready (root): SKIP (no .vercel/ link)`);
}
console.log("Done. Redeploy target apps to activate on running functions.");
