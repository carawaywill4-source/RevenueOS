#!/usr/bin/env node
/**
 * Apply supabase/migrations/20260810_revenueos_operator_claims.sql
 * to the ACTIVE portfolio Supabase project.
 *
 * Requires SUPABASE_ACCESS_TOKEN (supabase login) OR DATABASE_URL.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... node scripts/apply-operator-claims-migration.mjs
 *   DATABASE_URL=postgres://... node scripts/apply-operator-claims-migration.mjs
 *
 * Then verifies with a write/read/delete claim round-trip via PostgREST.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const sqlPath = path.join(
  ROOT,
  "supabase/migrations/20260810_revenueos_operator_claims.sql",
);
const sql = readFileSync(sqlPath, "utf8");

function parseEnv(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
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
    out[s.slice(0, i).trim()] = v;
  }
  return out;
}

const env = {
  ...parseEnv(path.join(ROOT, ".env.local")),
  ...parseEnv(path.join(ROOT, ".env.portfolio")),
  ...parseEnv(path.join(ROOT, "apps/raiseready/.env.local")),
  ...process.env,
};

const projectRef = (env.SUPABASE_URL || "")
  .replace(/^https?:\/\//, "")
  .split(".")[0];
const url = (env.SUPABASE_URL || "").replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (env.DATABASE_URL) {
  const r = spawnSync(
    "psql",
    [env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-f", sqlPath],
    { stdio: "inherit" },
  );
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
} else if (env.SUPABASE_ACCESS_TOKEN) {
  if (!projectRef) {
    console.error("Could not resolve Supabase project ref from SUPABASE_URL");
    process.exit(1);
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await res.text();
  if (!res.ok) {
    console.error("Migration apply failed", res.status, body.slice(0, 800));
    process.exit(1);
  }
  console.log("Applied operator-claims migration to", projectRef);
  console.log(body.slice(0, 300));
} else {
  console.error(
    "Set SUPABASE_ACCESS_TOKEN (supabase login) or DATABASE_URL, then re-run.",
  );
  console.error(
    "Until then, Vercel crons cannot respect Mac leases (table 404 → unclaimed).",
  );
  process.exit(1);
}

if (!url || !key) {
  console.warn("Skipping PostgREST verification — missing SUPABASE_URL/key");
  process.exit(0);
}

const testSite = `__claim_probe_${Date.now()}`;
const leaseUntil = new Date(Date.now() + 60_000).toISOString();
const upsert = await fetch(`${url}/rest/v1/revenueos_operator_claims`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify({
    site_id: testSite,
    owner: "migration-probe",
    lease_until: leaseUntil,
    claimed_at: new Date().toISOString(),
  }),
});
const upsertBody = await upsert.text();
if (!upsert.ok) {
  console.error("Claim write failed", upsert.status, upsertBody.slice(0, 400));
  process.exit(1);
}
console.log("Claim write OK", upsertBody.slice(0, 200));

const read = await fetch(
  `${url}/rest/v1/revenueos_operator_claims?site_id=eq.${encodeURIComponent(testSite)}&select=site_id,owner,lease_until`,
  {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  },
);
const rows = await read.json();
if (!read.ok || !Array.isArray(rows) || rows[0]?.owner !== "migration-probe") {
  console.error("Claim read failed", read.status, rows);
  process.exit(1);
}
console.log("Claim read OK", rows[0]);

await fetch(
  `${url}/rest/v1/revenueos_operator_claims?site_id=eq.${encodeURIComponent(testSite)}`,
  {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  },
);
console.log("Claim probe cleaned up. Migration verified.");
