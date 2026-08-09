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
  OPERATOR_NAME: z.string().default("operator-1"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SIDECAR_URL: z.string().url().optional(),
  SIDECAR_TOKEN: z.string().optional(),
  SIDECAR_DRY_RUN: z
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
});

export type OperatorEnv = z.infer<typeof schema>;

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
