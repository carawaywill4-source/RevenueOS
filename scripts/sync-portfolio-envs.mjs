#!/usr/bin/env node
/**
 * Sync a canonical set of environment variables to every portfolio Vercel
 * project so credentials live in ONE place. Add a new business by appending
 * its slug to PORTFOLIO_SITES and running:
 *
 *   node scripts/sync-portfolio-envs.mjs [--env production|preview|development]
 *
 * Reads canonical values from .env.portfolio (repo root — gitignored). Only
 * pushes keys listed in SHARED_KEYS; per-business overrides (like
 * RESEND_FROM_EMAIL) come from apps/<slug>/.env.local automatically.
 *
 * Requires `vercel` CLI logged in. Adds via `vercel env add` (upsert).
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

/** Every portfolio site that should receive shared credentials. */
export const PORTFOLIO_SITES = [
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
  // Add new businesses here — the next `sync` run will hydrate them.
];

/**
 * Keys treated as shared portfolio credentials. Per-business values (like a
 * per-brand FROM address) belong in apps/<slug>/.env.local, NOT here.
 */
export const SHARED_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "REVENUEOS_LLM_MODEL",
  "REVENUEOS_STRATEGIST_MODEL",
  "RESEND_API_KEY",
  "REDDIT_CLIENT_ID",
  "REDDIT_CLIENT_SECRET",
  "REDDIT_USERNAME",
  "REDDIT_PASSWORD",
  "REDDIT_USER_AGENT",
  "REDDIT_ALLOWED_SUBREDDITS",
  "REDDIT_DAILY_ACTION_CAP",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "PORTFOLIO_PULSE_TOKEN",
  "OWNER_DIALOG_TOKEN",
];

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function vercelEnv(args, cwd, stdin) {
  const res = spawnSync("vercel", args, {
    cwd,
    input: stdin,
    encoding: "utf8",
  });
  return {
    ok: res.status === 0,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

function existingKeys(cwd, envName) {
  const res = vercelEnv(["env", "ls", envName], cwd);
  if (!res.ok) return new Set();
  const set = new Set();
  for (const line of res.stdout.split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z0-9_]+)\s+Hidden/);
    if (m) set.add(m[1]);
  }
  return set;
}

function upsert(cwd, key, value, envName) {
  const has = existingKeys(cwd, envName).has(key);
  if (has) {
    vercelEnv(["env", "rm", key, envName, "-y"], cwd);
  }
  const res = vercelEnv(["env", "add", key, envName], cwd, value);
  return res.ok;
}

async function main() {
  const args = process.argv.slice(2);
  const envIdx = args.indexOf("--env");
  const envName = envIdx >= 0 ? args[envIdx + 1] : "production";
  const canonical = parseEnvFile(resolve(REPO, ".env.portfolio"));
  // Fallback: fill missing keys from root .env.local (developer convenience).
  const local = parseEnvFile(resolve(REPO, ".env.local"));
  for (const k of SHARED_KEYS) {
    if (!canonical[k] && local[k]) canonical[k] = local[k];
  }
  const missing = SHARED_KEYS.filter((k) => !canonical[k]);
  if (missing.length) {
    console.log(`skipping (no value): ${missing.join(", ")}`);
  }
  const present = SHARED_KEYS.filter((k) => canonical[k]);
  if (!present.length) {
    console.error("No shared keys have values. Set .env.portfolio or .env.local.");
    process.exit(1);
  }
  console.log(`Syncing ${present.length} key(s) to ${PORTFOLIO_SITES.length} site(s) in ${envName}:`);
  for (const site of PORTFOLIO_SITES) {
    const cwd = resolve(REPO, "apps", site);
    if (!existsSync(cwd)) {
      console.log(`  ${site}: SKIP (not found)`);
      continue;
    }
    const results = [];
    for (const key of present) {
      const ok = upsert(cwd, key, canonical[key], envName);
      results.push(`${ok ? "+" : "!"}${key}`);
    }
    console.log(`  ${site}: ${results.join(" ")}`);
  }
  console.log("Done. Redeploy to activate new envs on running functions.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
