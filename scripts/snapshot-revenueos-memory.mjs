#!/usr/bin/env node
/**
 * Snapshot RevenueOS durable memory row counts before macOS cutover.
 * Never resets data. Prints counts + SHA256 of sample IDs for verification.
 *
 * Usage: node scripts/snapshot-revenueos-memory.mjs
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env or .env.portfolio
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const p of [".env.portfolio", ".env.local", "services/operator/.env"]) {
    const full = resolve(ROOT, p);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const TABLES = [
  "revenueos_experiments",
  "revenueos_lessons",
  "revenueos_scorecards",
  "revenueos_attributions",
  "revenueos_planner_runs",
  "revenueos_cycle_reports",
  "revenueos_exposures",
  "revenueos_discovery_doors",
  "revenueos_capability_gaps",
  "revenueos_pursuits",
  "revenueos_pursuit_events",
  "revenueos_leases",
  "revenueos_captured_emails",
  "revenueos_channels",
  "revenueos_operator_claims",
];

async function countTable(url, key, table) {
  const res = await fetch(
    `${url}/rest/v1/${table}?select=id&limit=1`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  const cr = res.headers.get("content-range") || "";
  const m = cr.match(/\/(\d+)$/);
  if (!res.ok && res.status !== 206) {
    return { table, ok: false, error: `${res.status} ${await res.text()}` };
  }
  return { table, ok: true, count: m ? Number(m[1]) : null, contentRange: cr };
}

async function main() {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const rows = [];
  for (const table of TABLES) {
    const r = await countTable(url.replace(/\/$/, ""), key, table);
    rows.push(r);
    console.log(
      r.ok
        ? `${table.padEnd(32)} ${String(r.count).padStart(8)}`
        : `${table.padEnd(32)} ERROR ${r.error?.slice(0, 80)}`,
    );
  }
  const payload = {
    at: new Date().toISOString(),
    project: url,
    tables: rows,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(rows))
      .digest("hex")
      .slice(0, 16),
  };
  const outDir = resolve(ROOT, ".data");
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, `memory-snapshot-${Date.now()}.json`);
  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${out}`);
  console.log(`fingerprint ${payload.fingerprint}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
