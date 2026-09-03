#!/usr/bin/env node
/**
 * Apply packages/revenueos/schema.sql to the shared portfolio Supabase project.
 *
 * Requires SUPABASE_ACCESS_TOKEN (supabase login) OR DATABASE_URL.
 * Document-mode pursuit persistence works without this; native tables are faster.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... node scripts/apply-revenueos-pursuit-schema.mjs
 *   DATABASE_URL=postgres://... node scripts/apply-revenueos-pursuit-schema.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const sqlPath = path.join(ROOT, "packages/revenueos/schema.sql");
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
  ...parseEnv(path.join(ROOT, "apps/raiseready/.env.local")),
  ...process.env,
};
const projectRef = (env.SUPABASE_URL || "")
  .replace(/^https?:\/\//, "")
  .split(".")[0];

if (env.DATABASE_URL) {
  const r = spawnSync("psql", [env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
}

if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error(
    "Set SUPABASE_ACCESS_TOKEN (supabase login) or DATABASE_URL, then re-run.",
  );
  console.error(
    "Until then, production uses document-mode pursuit persistence in revenueos_experiments.",
  );
  process.exit(1);
}

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
  console.error("Schema apply failed", res.status, body.slice(0, 500));
  process.exit(1);
}
console.log("Applied packages/revenueos/schema.sql to", projectRef);
console.log(body.slice(0, 300));
