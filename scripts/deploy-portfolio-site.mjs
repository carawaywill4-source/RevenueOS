#!/usr/bin/env node
/**
 * Vendor packages, create/link Vercel project, copy secrets from a donor .env,
 * create Stripe webhook, deploy production.
 *
 * Usage: node scripts/deploy-portfolio-site.mjs <siteId> [--donor apps/mendhaus/.env.local]
 */
import { execSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const siteId = process.argv[2];
if (!siteId) {
  console.error("Usage: node scripts/deploy-portfolio-site.mjs <siteId>");
  process.exit(1);
}
const donorArg = process.argv.includes("--donor")
  ? process.argv[process.argv.indexOf("--donor") + 1]
  : "apps/mendhaus/.env.local";
const appDir = path.join(ROOT, "apps", siteId);
if (!fs.existsSync(appDir)) {
  console.error("missing app", appDir);
  process.exit(1);
}

function parseEnv(filePath) {
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    let v = s.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v.includes("[SENSITIVE]")) continue;
    out[s.slice(0, i).trim()] = v;
  }
  return out;
}

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: opts.cwd || ROOT, stdio: "inherit", ...opts });
}


function resolveProdUrl(siteId) {
  try {
    const r = spawnSync("vercel", ["ls"], { cwd: appDir, encoding: "utf8" });
    const aliased = [...(r.stdout || "").matchAll(/https:\/\/[a-z0-9-]+\.vercel\.app/g)].map(m=>m[0]);
    // Prefer clean project.vercel.app or project-word.vercel.app
    const preferred = aliased.find((u) => u.includes(`${siteId}.`) || u.includes(`${siteId}-`));
    if (preferred) return preferred;
  } catch {}
  return `https://${siteId}.vercel.app`;
}

function vercelEnv(key, value) {
  spawnSync("vercel", ["env", "rm", key, "production", "-y"], {
    cwd: appDir,
    stdio: "ignore",
  });
  const r = spawnSync("vercel", ["env", "add", key, "production"], {
    cwd: appDir,
    input: value,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error("env fail", key, r.stderr?.slice(0, 200));
    process.exit(1);
  }
  console.log("env", key, "len", value.length);
}

console.log("prepare", siteId);
sh(`bash scripts/prepare-portfolio-deploy.sh ${siteId}`);

const donor = parseEnv(path.join(ROOT, donorArg));
const stripe = donor.STRIPE_SECRET_KEY;
const cron = donor.CRON_SECRET || crypto.randomBytes(32).toString("hex");
const resend = donor.RESEND_API_KEY;
const supabaseUrl = donor.SUPABASE_URL;
const supabaseKey = donor.SUPABASE_SERVICE_ROLE_KEY;
const owner = donor.OWNER_ALERT_EMAIL || donor.OWNER_EMAIL || "will739944c@gmail.com";
const indexnow = crypto.randomBytes(16).toString("hex");
if (!stripe?.startsWith("sk_") || !resend?.startsWith("re_")) {
  console.error("donor env missing live stripe/resend");
  process.exit(1);
}

// Ensure project exists
try {
  sh("vercel link --yes --project " + siteId, { cwd: appDir });
} catch {
  sh("vercel --yes", { cwd: appDir }); // creates project via first deploy preview-ish
}

// Placeholder URL until alias known — first deploy gets vercel.app
let appUrl = process.env.FORCE_APP_URL || "";
if (!appUrl) {
  // Deploy once to get URL
  console.log("initial deploy to obtain URL…");
}

const pub = path.join(appDir, "public");
fs.mkdirSync(pub, { recursive: true });
for (const f of fs.readdirSync(pub)) {
  if (f.endsWith(".txt") && f !== "robots.txt") fs.unlinkSync(path.join(pub, f));
}
fs.writeFileSync(path.join(pub, `${indexnow}.txt`), indexnow);

// Create webhook after we know URL — set temp, deploy, update
const localEnv = {
  CRON_SECRET: cron,
  STRIPE_SECRET_KEY: stripe,
  RESEND_API_KEY: resend,
  OWNER_ALERT_EMAIL: owner,
  INDEXNOW_KEY: indexnow,
  NEXT_PUBLIC_CHECKOUT_ENABLED: "1",
  REVENUEOS_LEDGER_DIR: "/tmp/revenueos",
  RESEND_FROM_EMAIL:
    donor.RESEND_FROM_EMAIL || `${siteId} <onboarding@resend.dev>`,
};
if (supabaseUrl && supabaseKey) {
  localEnv.SUPABASE_URL = supabaseUrl;
  localEnv.SUPABASE_SERVICE_ROLE_KEY = supabaseKey;
}

// Link / create project without full deploy first
spawnSync("vercel", ["link", "--yes", "--project", siteId], {
  cwd: appDir,
  stdio: "inherit",
});

for (const [k, v] of Object.entries(localEnv)) vercelEnv(k, v);
vercelEnv("NEXT_PUBLIC_APP_URL", `https://${siteId}.vercel.app`);

console.log("deploying…");
sh("vercel --prod --yes", { cwd: appDir });

// Resolve production URL
const inspect = spawnSync("vercel", ["ls", siteId, "--prod"], {
  cwd: appDir,
  encoding: "utf8",
});
const aliasMatch =
  inspect.stdout?.match(/https:\/\/[a-z0-9-]+\.vercel\.app/) ||
  [];
let prodUrl = resolveProdUrl(siteId);
// Prefer *-*.vercel.app from inspect JSON
try {
  const j = spawnSync(
    "vercel",
    ["inspect", siteId, "--prod", "--json"],
    { cwd: appDir, encoding: "utf8" },
  );
  const data = JSON.parse(j.stdout || "{}");
  const aliases = data.aliases || data.url;
  if (typeof aliases === "string") prodUrl = aliases.startsWith("http") ? aliases : `https://${aliases}`;
  else if (Array.isArray(aliases) && aliases[0]) {
    prodUrl = aliases[0].startsWith("http") ? aliases[0] : `https://${aliases[0]}`;
  }
} catch {
  /* keep default */
}

vercelEnv("NEXT_PUBLIC_APP_URL", prodUrl);

// Stripe webhook
try {
  const form = new URLSearchParams();
  form.set("url", `${prodUrl}/api/stripe/webhook`);
  form.append("enabled_events[]", "checkout.session.completed");
  form.append("enabled_events[]", "checkout.session.expired");
  form.append("enabled_events[]", "charge.refunded");
  const resp = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripe}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = await resp.json();
  if (data.secret) {
    vercelEnv("STRIPE_WEBHOOK_SECRET", data.secret);
    console.log("webhook", data.id);
  } else {
    console.warn("webhook create failed", data.error || data);
    if (donor.STRIPE_WEBHOOK_SECRET) {
      vercelEnv("STRIPE_WEBHOOK_SECRET", donor.STRIPE_WEBHOOK_SECRET);
    }
  }
} catch (e) {
  console.warn("webhook error", e.message);
}

// Persist local env (no print of secrets)
const lines = Object.entries({
  ...localEnv,
  NEXT_PUBLIC_APP_URL: prodUrl,
}).map(([k, v]) => `${k}=${v}`);
fs.writeFileSync(path.join(appDir, ".env.local"), lines.join("\n") + "\n");

console.log("redeploy with final URL/webhook…");
sh("vercel --prod --yes", { cwd: appDir });
console.log("LIVE", prodUrl);
fs.writeFileSync(
  path.join(ROOT, `.data/deploy-${siteId}.json`),
  JSON.stringify({ siteId, prodUrl, cronLen: cron.length, indexnow }, null, 2),
);
