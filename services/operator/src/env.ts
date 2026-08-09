import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Environment schema for the persistent operator service.
 *
 * Loaded once at boot. If a variable is missing the service still starts
 * but logs why capability X is unavailable — for example the sidecar
 * bridge is optional in dev-only mode.
 */
const schema = z.object({
  NODE_ENV: z.string().default("production"),
  PORT: z.coerce.number().default(8080),
  OPERATOR_NAME: z.string().default("mac-revenueos-core"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SIDECAR_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined))
    .pipe(z.string().url().optional()),
  SIDECAR_TOKEN: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  SIDECAR_DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  /**
   * Shadow mode: observe + plan + enqueue learning reads, but do not claim
   * businesses and do not execute commercial actions. Use before first cutover.
   */
  SHADOW_MODE: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  /**
   * When false (default until claims table is verified), Core never writes
   * revenueos_operator_claims. Safe with Vercel still owning execution.
   */
  CLAIM_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  MAX_CONCURRENCY: z.coerce.number().default(3),
  PER_BUSINESS_MIN_INTERVAL_MS: z.coerce.number().default(30_000),
  TICK_BUDGET_MS: z.coerce.number().default(180_000),
  MAX_JOBS_PER_TICK: z.coerce.number().default(24),
  CLAIM_LEASE_MS: z.coerce.number().default(5 * 60_000),
  BUSINESSES: z
    .string()
    .optional()
    .describe(
      "Comma-separated list of siteIds to run. Defaults to entire portfolio.",
    ),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  REVENUEOS_STRATEGIST_MODEL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
});

export type OperatorEnv = z.infer<typeof schema>;

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
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

/**
 * Merge local env files into process.env without overwriting already-set
 * values (launchd / shell wins). Looks in services/operator/.env then
 * repo .env.portfolio / .env.local.
 */
export function hydrateEnvFromFiles(
  cwd: string = process.cwd(),
): void {
  // This file lives at services/operator/src/env.ts
  const here = path.dirname(fileURLToPath(import.meta.url));
  const operatorRoot = path.resolve(here, "..");
  const repoRoot = path.resolve(operatorRoot, "../..");
  const files = [
    path.join(operatorRoot, ".env"),
    path.join(repoRoot, ".env.portfolio"),
    path.join(repoRoot, ".env.local"),
    path.join(cwd, ".env"),
  ];
  for (const file of files) {
    const parsed = parseEnvFile(file);
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined || process.env[k] === "") {
        process.env[k] = v;
      }
    }
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): OperatorEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`operator env invalid:\n${missing}`);
  }
  return parsed.data;
}
