#!/usr/bin/env node
/**
 * Pin each portfolio app's `NEXT_PUBLIC_APP_URL` on Vercel to its canonical
 * production host. Exposure URLs and pulse `exposureNotes` are only useful if
 * they still resolve after the next deploy — the deployment host
 * (`${siteId}-<hash>-<team>.vercel.app`) does not.
 *
 * Usage: node scripts/sync-canonical-urls.mjs [--env production|preview]
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

const CANONICAL_APP_URLS = {
  bidbinder: "https://bidbinder.vercel.app",
  closeshift: "https://closeshift.vercel.app",
  depositproof: "https://depositproof-omega.vercel.app",
  ledgerleaf: "https://ledgerleaf-ashen.vercel.app",
  listinglift: "https://listinglift-eight.vercel.app",
  raiseready: "https://raiseready-seven.vercel.app",
  resumeforge: "https://resumeforge-liard.vercel.app",
  shopbeacon: "https://shopbeacon.vercel.app",
  turnoverkit: "https://turnoverkit.vercel.app",
  waitroom: "https://waitroom-sepia.vercel.app",
};

function vercel(args, cwd, stdin) {
  const res = spawnSync("vercel", args, {
    cwd,
    input: stdin,
    encoding: "utf8",
  });
  return { ok: res.status === 0, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function upsert(cwd, key, value, envName) {
  vercel(["env", "rm", key, envName, "-y"], cwd);
  const res = vercel(["env", "add", key, envName], cwd, value);
  return res.ok;
}

const envIdx = process.argv.indexOf("--env");
const envName = envIdx >= 0 ? process.argv[envIdx + 1] : "production";

console.log(`Pinning NEXT_PUBLIC_APP_URL on ${Object.keys(CANONICAL_APP_URLS).length} site(s) in ${envName}:`);
for (const [site, url] of Object.entries(CANONICAL_APP_URLS)) {
  const cwd = resolve(REPO, "apps", site);
  if (!existsSync(cwd)) {
    console.log(`  ${site}: SKIP (not found)`);
    continue;
  }
  const ok = upsert(cwd, "NEXT_PUBLIC_APP_URL", url, envName);
  console.log(`  ${site}: ${ok ? "+" : "!"}${url}`);
}
console.log("Done. Redeploy to activate on running functions.");
