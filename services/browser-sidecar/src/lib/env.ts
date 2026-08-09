import { z } from "zod";
import path from "node:path";
import os from "node:os";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(7071),
  SIDECAR_TOKEN: z.string().min(8),
  DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  /** Absolute path to a chromium user profile directory. Persists cookies. */
  PROFILE_DIR: z
    .string()
    .optional()
    .default(path.join(os.homedir(), ".revenueos-sidecar/chromium")),
  /** Screenshot output directory. */
  SCREENSHOT_DIR: z
    .string()
    .optional()
    .default(path.join(os.homedir(), ".revenueos-sidecar/screenshots")),
  /** Whether to run headless. Recommended false for real posting. */
  HEADLESS: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  /** Per-platform daily action cap. */
  DAILY_ACTION_CAP: z.coerce.number().default(20),
});

export type SidecarEnv = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): SidecarEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`sidecar env invalid:\n${detail}`);
  }
  return parsed.data;
}
