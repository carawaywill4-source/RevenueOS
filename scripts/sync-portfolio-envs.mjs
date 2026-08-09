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
  "PRODUCTHUNT_API_KEY",
  "PRODUCTHUNT_API_SECRET",
  "PRODUCTHUNT_DEVELOPER_TOKEN",
  "GUMROAD_APPLICATION_ID",
  "GUMROAD_APPLICATION_SECRET",
  "GUMROAD_ACCESS_TOKEN",
  "GUMROAD_SELLER_ID",
  "YOUTUBE_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GA4_MEASUREMENT_ID_BIDBINDER",
  "GA4_MEASUREMENT_ID_CLOSESHIFT",
  "GA4_MEASUREMENT_ID_DEPOSITPROOF",
  "GA4_MEASUREMENT_ID_LEDGERLEAF",
  "GA4_MEASUREMENT_ID_LISTINGLIFT",
  "GA4_MEASUREMENT_ID_RAISEREADY",
  "GA4_MEASUREMENT_ID_RESUMEFORGE",
  "GA4_MEASUREMENT_ID_SHOPBEACON",
  "GA4_MEASUREMENT_ID_TURNOVERKIT",
  "GA4_MEASUREMENT_ID_WAITROOM",
  "GSC_VERIFICATION_BIDBINDER",
  "GSC_VERIFICATION_CLOSESHIFT",
  "GSC_VERIFICATION_DEPOSITPROOF",
  "GSC_VERIFICATION_LEDGERLEAF",
  "GSC_VERIFICATION_LISTINGLIFT",
  "GSC_VERIFICATION_RAISEREADY",
  "GSC_VERIFICATION_RESUMEFORGE",
  "GSC_VERIFICATION_SHOPBEACON",
  "GSC_VERIFICATION_TURNOVERKIT",
  "GSC_VERIFICATION_WAITROOM",
  "BING_WEBMASTER_API_KEY",
  "DEVTO_API_KEY",
  "MEDIUM_INTEGRATION_TOKEN",
  "SUBSTACK_SESSION_COOKIE",
  "QUORA_SESSION_COOKIE",
  // Indie Hackers (optional session cookie enables direct writes; drafts always work).
  "INDIEHACKERS_SESSION_COOKIE",
  "INDIEHACKERS_USER_AGENT",
  "INDIEHACKERS_DAILY_ACTION_CAP",
  // Hacker News (optional creds enable write flow; drafts default).
  "HN_USERNAME",
  "HN_PASSWORD",
  "HN_USER_AGENT",
  "HN_DAILY_DISCOVERY_CAP",
  // YouTube Data API v3 optional oauth token (for comment writes).
  "YOUTUBE_OAUTH_TOKEN",
  "YOUTUBE_USER_AGENT",
  "YOUTUBE_DAILY_DISCOVERY_CAP",
  // Google Search Console user agent override.
  "GSC_USER_AGENT",
  // Signed UTM attribution HMAC secret.
  "REVENUEOS_ATTRIBUTION_SECRET",
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
  const skipTr = args.includes("--skip-tr");
  const canonical = parseEnvFile(resolve(REPO, ".env.portfolio"));
  // Fallback: fill missing keys from root .env.local (developer convenience).
  const local = parseEnvFile(resolve(REPO, ".env.local"));
  for (const k of SHARED_KEYS) {
    if (!canonical[k] && local[k]) canonical[k] = local[k];
  }
  // Ensure PORTFOLIO_PULSE_TOKEN is defined and matches the shared portfolio
  // CRON_SECRET. TR's digest fetcher sends `PORTFOLIO_PULSE_TOKEN || CRON_SECRET`
  // — if TR falls back to its OWN CRON_SECRET the portfolio sites 401 because
  // their CRON_SECRET is different (a fresh one is minted per portfolio deploy).
  // Pinning `PORTFOLIO_PULSE_TOKEN = portfolio CRON_SECRET` is the invariant
  // that guarantees digest→pulse auth succeeds portfolio-wide.
  if (!canonical.PORTFOLIO_PULSE_TOKEN && canonical.CRON_SECRET) {
    canonical.PORTFOLIO_PULSE_TOKEN = canonical.CRON_SECRET;
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
  // Also push the pulse auth secret to the TR project itself so the portfolio
  // digest cron fetches each portfolio pulse endpoint with a token those
  // endpoints accept (they check the same list). Never sync ALL shared keys
  // to TR (its Stripe/Resend etc. differ) — pulse auth is the only leaking key.
  if (!skipTr && canonical.PORTFOLIO_PULSE_TOKEN && existsSync(resolve(REPO, ".vercel"))) {
    const okA = upsert(REPO, "PORTFOLIO_PULSE_TOKEN", canonical.PORTFOLIO_PULSE_TOKEN, envName);
    console.log(`  tributeready (root): ${okA ? "+" : "!"}PORTFOLIO_PULSE_TOKEN`);
  } else if (!skipTr) {
    console.log(`  tributeready (root): SKIP (missing .vercel/ link or no PORTFOLIO_PULSE_TOKEN)`);
  }
  console.log("Done. Redeploy to activate new envs on running functions.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
