#!/usr/bin/env node
/**
 * Apply / verify operator-claims storage on the ACTIVE RevenueOS Supabase project.
 *
 * Uses existing local credentials only (never prints secrets):
 *   .env.local → apps/raiseready/.env.local → .env.portfolio → services/operator/.env
 *
 * Paths:
 *   A) DATABASE_URL or SUPABASE_ACCESS_TOKEN → apply SQL migration, then PostgREST R/W probe
 *   B) Otherwise → document-mode claims in revenueos_experiments (same project), R/W probe
 *
 * Usage:
 *   node scripts/apply-operator-claims-migration.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const sqlPath = path.join(
  ROOT,
  "supabase/migrations/20260810_revenueos_operator_claims.sql",
);

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
    if (v.startsWith("[SENSI")) continue;
    out[s.slice(0, i).trim()] = v;
  }
  return out;
}

function projectRef(url) {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return null;
  }
}

const files = [
  path.join(ROOT, ".env.local"),
  path.join(ROOT, "apps/raiseready/.env.local"),
  path.join(ROOT, ".env.portfolio"),
  path.join(ROOT, "services/operator/.env"),
  path.join(ROOT, ".env.development.local"),
];
const env = { ...process.env };
const provenance = {};
for (const f of files) {
  const parsed = parseEnv(f);
  for (const [k, v] of Object.entries(parsed)) {
    if (env[k] === undefined || env[k] === "") {
      env[k] = v;
      provenance[k] = path.relative(ROOT, f);
    }
  }
}

const url = (env.SUPABASE_URL || "").replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const ref = projectRef(url);

if (!url || !key) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in local env files.",
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      projectRef: ref,
      supabaseSource: provenance.SUPABASE_URL || "process.env",
      hasDatabaseUrl: Boolean(env.DATABASE_URL || env.POSTGRES_URL || env.DIRECT_URL),
      hasAccessToken: Boolean(env.SUPABASE_ACCESS_TOKEN),
    },
    null,
    2,
  ),
);

let nativeApplied = false;
const sql = readFileSync(sqlPath, "utf8");
const dbUrl = env.DATABASE_URL || env.POSTGRES_URL || env.DIRECT_URL;

if (dbUrl) {
  const r = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    stdio: "inherit",
  });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
  nativeApplied = true;
  console.log("Applied SQL migration via DATABASE_URL/POSTGRES_URL");
} else if (env.SUPABASE_ACCESS_TOKEN) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
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
    console.error("Management API SQL failed", res.status, body.slice(0, 200));
    process.exit(1);
  }
  nativeApplied = true;
  console.log("Applied SQL migration via SUPABASE_ACCESS_TOKEN");
} else {
  console.log(
    JSON.stringify({
      sqlMigration: "skipped",
      reason:
        "No DATABASE_URL/POSTGRES_URL/DIRECT_URL/SUPABASE_ACCESS_TOKEN in local or Vercel-pulled env",
      fallback: "document-mode claims in revenueos_experiments",
      note: "Service role is present and sufficient for document-mode R/W on the same project",
    }),
  );
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testSite = `__claim_probe_${Date.now()}`;
const leaseUntil = new Date(Date.now() + 60_000).toISOString();
const claimedAt = new Date().toISOString();
const owner = "migration-probe";

async function probeNative() {
  const { error: writeErr } = await client.from("revenueos_operator_claims").upsert(
    {
      site_id: testSite,
      owner,
      lease_until: leaseUntil,
      claimed_at: claimedAt,
    },
    { onConflict: "site_id" },
  );
  if (writeErr) {
    return { ok: false, error: writeErr.code || writeErr.message };
  }
  const { data, error: readErr } = await client
    .from("revenueos_operator_claims")
    .select("site_id,owner,lease_until")
    .eq("site_id", testSite)
    .maybeSingle();
  if (readErr || data?.owner !== owner) {
    return { ok: false, error: readErr?.message || "read_mismatch" };
  }
  await client.from("revenueos_operator_claims").delete().eq("site_id", testSite);
  return { ok: true, storage: "native" };
}

async function probeDocument() {
  const id = `ros:opclaim:${testSite}`;
  const document = {
    site_id: testSite,
    owner,
    lease_until: leaseUntil,
    claimed_at: claimedAt,
  };
  const { error: writeErr } = await client.from("revenueos_experiments").upsert(
    {
      id,
      site_id: testSite,
      status: "operator_claim",
      pattern_key: `operator_claim:${testSite}`,
      category: "__ros_operator_claim__",
      document,
      updated_at: claimedAt,
    },
    { onConflict: "id" },
  );
  if (writeErr) {
    return { ok: false, error: writeErr.code || writeErr.message };
  }
  const { data, error: readErr } = await client
    .from("revenueos_experiments")
    .select("document")
    .eq("id", id)
    .maybeSingle();
  const doc = data?.document;
  if (readErr || doc?.owner !== owner) {
    return { ok: false, error: readErr?.message || "read_mismatch" };
  }

  // Also verify brain checkOperatorHosting path
  const { checkOperatorHosting } = await import(
    "../packages/revenueos/src/modules/operator-claims.ts"
  );
  const hosted = await checkOperatorHosting(testSite, {
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: key,
  });

  await client.from("revenueos_experiments").delete().eq("id", id);

  if (!hosted.hosted || hosted.reason !== "active_claim") {
    return {
      ok: false,
      error: "checkOperatorHosting_did_not_see_claim",
      hosted,
    };
  }
  return {
    ok: true,
    storage: "document",
    checkOperatorHosting: {
      hosted: hosted.hosted,
      reason: hosted.reason,
      storage: hosted.storage,
    },
  };
}

let result;
if (nativeApplied) {
  result = await probeNative();
  if (!result.ok) {
    console.error("Native claim probe failed", result);
    process.exit(1);
  }
} else {
  const nativeTry = await probeNative();
  if (nativeTry.ok) {
    result = nativeTry;
    nativeApplied = true;
  } else {
    result = await probeDocument();
    if (!result.ok) {
      console.error("Document claim probe failed", result);
      process.exit(1);
    }
  }
}

console.log(
  JSON.stringify(
    {
      verified: true,
      projectRef: ref,
      storage: result.storage,
      nativeTableApplied: nativeApplied,
      checkOperatorHosting: result.checkOperatorHosting ?? null,
      probeCleanedUp: true,
    },
    null,
    2,
  ),
);
