import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Environment schema for the persistent operator service.
 *
 * Native Postgres mode (cutover):
 *   REVENUEOS_DATA_PROVIDER=postgres
 *   REVENUEOS_DATABASE_URL=postgresql://...
 *   SUPABASE_DISABLED=1  (or SUPABASE=DISABLED)
 * Supabase URL/key must NOT be required in that mode.
 */
const schema = z
  .object({
    NODE_ENV: z.string().default("production"),
    PORT: z.coerce.number().default(8080),
    OPERATOR_NAME: z.string().default("mac-revenueos-core"),
    REVENUEOS_DATA_PROVIDER: z
      .enum(["supabase", "postgres"])
      .default("supabase"),
    REVENUEOS_DATABASE_URL: z.string().optional(),
    SUPABASE_DISABLED: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "true" || v === "DISABLED"),
    SUPABASE: z.string().optional(),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
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
    SHADOW_MODE: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "true"),
    CLAIM_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "true"),
    MAX_CONCURRENCY: z.coerce.number().default(2),
    PER_BUSINESS_MIN_INTERVAL_MS: z.coerce.number().default(45_000),
    TICK_BUDGET_MS: z.coerce.number().default(120_000),
    MAX_JOBS_PER_TICK: z.coerce.number().default(8),
    CLAIM_LEASE_MS: z.coerce.number().default(10 * 60_000),
    BUSINESSES: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().optional(),
    REVENUEOS_STRATEGIST_MODEL: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const supabaseOff =
      val.SUPABASE_DISABLED === true ||
      val.SUPABASE === "DISABLED" ||
      val.REVENUEOS_DATA_PROVIDER === "postgres";
    if (supabaseOff || val.REVENUEOS_DATA_PROVIDER === "postgres") {
      if (!val.REVENUEOS_DATABASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["REVENUEOS_DATABASE_URL"],
          message: "required when REVENUEOS_DATA_PROVIDER=postgres",
        });
      }
      return;
    }
    if (!val.SUPABASE_URL || !/^https?:\/\//.test(val.SUPABASE_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message: "valid url required for supabase provider",
      });
    }
    if (!val.SUPABASE_SERVICE_ROLE_KEY || val.SUPABASE_SERVICE_ROLE_KEY.length < 20) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message: "required for supabase provider",
      });
    }
  });

export type OperatorEnv = z.infer<typeof schema> & {
  /** Resolved provider after env normalization. */
  dataProvider: "postgres" | "supabase";
};

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
 * Merge platform env files into process.env without overwriting already-set
 * values (launchd / shell wins).
 *
 * Platform config only — never apps/<business>/.env.local (Mendhaus/etc.).
 */
export function hydrateEnvFromFiles(cwd: string = process.cwd()): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const operatorRoot = path.resolve(here, "..");
  const repoRoot = path.resolve(operatorRoot, "../..");
  const files = [
    // Dedicated platform config (preferred)
    path.join(repoRoot, ".env.revenueos-platform"),
    path.join(operatorRoot, ".env"),
    // Repo-level platform secrets (not per-business)
    path.join(repoRoot, ".env.portfolio"),
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
  const data = parsed.data;
  const supabaseOff =
    data.SUPABASE_DISABLED === true ||
    data.SUPABASE === "DISABLED" ||
    data.REVENUEOS_DATA_PROVIDER === "postgres";
  const dataProvider: "postgres" | "supabase" = supabaseOff
    ? "postgres"
    : data.REVENUEOS_DATA_PROVIDER;
  return { ...data, dataProvider };
}
