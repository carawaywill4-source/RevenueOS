/**
 * FIX 11+12 — Browser resource governance + session security.
 */

import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";

const MAX_CONCURRENT = Number(process.env.ULTRON_BROWSER_MAX_CONTEXTS ?? 1);
const MAX_PAGES = Number(process.env.ULTRON_BROWSER_MAX_PAGES ?? 2);
const IDLE_TTL_MS = Number(process.env.ULTRON_BROWSER_IDLE_TTL_MS ?? 120_000);
const MIN_AVAIL_MB = Number(process.env.ULTRON_BROWSER_MIN_AVAIL_MB ?? 220);
const ARTIFACT_ROOT = process.env.ULTRON_BROWSER_ARTIFACTS || "/opt/revenueos/data/browser-artifacts";

let inFlight = 0;
const waiters: Array<() => void> = [];

export function browserSlotCount(): { inFlight: number; max: number } {
  return { inFlight, max: MAX_CONCURRENT };
}

export async function availableMemMb(): Promise<number> {
  try {
    const raw = await readFile("/proc/meminfo", "utf8");
    const m = raw.match(/MemAvailable:\s+(\d+)\s+kB/);
    if (!m) return 9999;
    return Math.floor(Number(m[1]) / 1024);
  } catch {
    return 9999;
  }
}

export async function acquireBrowserSlot(logger: Logger): Promise<{ ok: true } | { ok: false; reason: string }> {
  const avail = await availableMemMb();
  if (avail < MIN_AVAIL_MB) {
    logger("warn", "ultron.browser.backpressure", { avail, min: MIN_AVAIL_MB });
    return { ok: false, reason: `memory_pressure availMb=${avail} min=${MIN_AVAIL_MB}` };
  }
  if (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  inFlight++;
  return { ok: true };
}

export function releaseBrowserSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
  const next = waiters.shift();
  if (next) next();
}

export function ensureSecureArtifactRoot(): void {
  if (!existsSync(ARTIFACT_ROOT)) {
    mkdirSync(ARTIFACT_ROOT, { recursive: true, mode: 0o700 });
  }
}

export function isolationKey(businessId?: string | null, platform?: string | null): string {
  return `${businessId ?? "org"}::${platform ?? "web"}`;
}

export function redactSecrets(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .slice(0, 200);
}

export async function cleanupIdleSessions(pool: pg.Pool, logger: Logger): Promise<number> {
  const r = await pool.query(
    `update ros_browser_sessions
        set state = 'EXPIRED', updated_at = now()
      where state in ('ACTIVE','INIT')
        and coalesce(last_action_at, created_at) < now() - ($1::int * interval '1 millisecond')
      returning session_id`,
    [IDLE_TTL_MS],
  );
  logger("info", "ultron.browser.idle_cleanup", { n: r.rowCount ?? 0 });
  return r.rowCount ?? 0;
}

export async function revokeSession(pool: pg.Pool, sessionId: string): Promise<void> {
  await pool.query(
    `update ros_browser_sessions
        set state = 'REVOKED', storage_state = '{}'::jsonb, cookies = '[]'::jsonb,
            revoked_at = now(), updated_at = now()
      where session_id = $1`,
    [sessionId],
  );
}

export { MAX_PAGES, ARTIFACT_ROOT };
