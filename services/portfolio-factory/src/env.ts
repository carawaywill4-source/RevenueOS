import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.js";

export function loadFactoryEnv(): void {
  const candidates = [
    path.join(repoRoot(), "services/operator/.env"),
    path.join(repoRoot(), "services/portfolio-factory/.env"),
    path.join(repoRoot(), ".env"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (process.env[m[1]]) continue;
      let v = m[2] ?? "";
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}

export function requireFactoryEnv() {
  loadFactoryEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cron = process.env.CRON_SECRET;
  if (!url || !key || !cron) {
    throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or CRON_SECRET");
  }
  return { supabaseUrl: url, supabaseServiceRoleKey: key, cronSecret: cron };
}
