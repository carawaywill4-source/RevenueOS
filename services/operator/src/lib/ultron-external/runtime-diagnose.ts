/**
 * CURSOR-TEACHER 2: RUNTIME_CONSTRAINT_DIAGNOSIS.
 *
 * Would have caught:
 *   NoNewPrivileges=yes blocking systemctl restart
 *   Chromium not installed
 *   Memory pressure for headless browsers
 *   Caddy admin API location
 *
 * Emits structured world facts + runtime-fact rows other subsystems query.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statfsSync } from "node:fs";
import { totalmem, freemem } from "node:os";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { recordWorldFact } from "../ultron-core/world-model.js";
import type { Logger } from "../ultron-core/types.js";

function probe(cmd: string, args: string[]): { stdout: string; ok: boolean } {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 5000 });
    return { stdout: (r.stdout || "").trim(), ok: r.status === 0 };
  } catch {
    return { stdout: "", ok: false };
  }
}

async function persistRuntimeFact(
  pool: pg.Pool,
  probeName: string,
  value: Record<string, unknown>,
  severity: "INFO" | "WARN" | "ERROR" = "INFO",
): Promise<void> {
  await pool.query(
    `insert into ros_runtime_facts (fact_id, probe, value, observed_at, severity)
     values ($1, $2, $3::jsonb, now(), $4)`,
    [`rt_${randomUUID().slice(0, 12)}`, probeName, JSON.stringify(value), severity],
  );
}

export async function runRuntimeDiagnosis(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ facts: number; blockers: string[] }> {
  const blockers: string[] = [];
  let facts = 0;

  // 1. systemd security constraints (may not be reachable outside the service).
  const systemd = probe("systemctl", ["show", "revenueos-operator", "-p", "NoNewPrivileges", "-p", "MemoryLimit", "-p", "MemoryHigh", "-p", "ProtectHome", "-p", "ProtectSystem"]);
  if (systemd.stdout) {
    const parsed: Record<string, string> = {};
    for (const line of systemd.stdout.split("\n")) {
      const [k, v] = line.split("=", 2);
      if (k) parsed[k] = v ?? "";
    }
    const value = { ...parsed };
    await persistRuntimeFact(pool, "systemd_security", value);
    await recordWorldFact(pool, {
      entityKind: "runtime",
      entityId: "revenueos-operator",
      predicate: "systemd_security",
      value,
      source: "systemctl show",
      confidence: 0.99,
      ttlHours: 720,
    });
    if (parsed.NoNewPrivileges === "yes") {
      blockers.push("NoNewPrivileges=yes — self-restart via sudo systemctl is blocked; use process.exit(0)");
    }
    facts++;
  }

  // 2. Chromium / Playwright.
  const chromium = probe("bash", ["-lc", "which chromium || which google-chrome || which chromium-browser"]);
  const playwrightDir = existsSync(`${process.env.HOME || "/root"}/.cache/ms-playwright`);
  const chromiumValue = {
    systemBinary: chromium.stdout || null,
    playwrightCache: playwrightDir,
    availableForOperator: !!(chromium.stdout || playwrightDir),
  };
  await persistRuntimeFact(
    pool,
    "browser_chromium",
    chromiumValue,
    chromiumValue.availableForOperator ? "INFO" : "WARN",
  );
  await recordWorldFact(pool, {
    entityKind: "runtime",
    entityId: "browser",
    predicate: "chromium_available",
    value: chromiumValue,
    source: "which+fs",
    confidence: 0.98,
    ttlHours: 24,
  });
  if (!chromiumValue.availableForOperator) {
    blockers.push("No Chromium binary installed and no playwright cache — browser operator will fail until installed.");
  }
  facts++;

  // 3. Memory pressure.
  const total = totalmem();
  const free = freemem();
  const meminfoText = existsSync("/proc/meminfo") ? readFileSync("/proc/meminfo", "utf8") : "";
  const availableMatch = meminfoText.match(/MemAvailable:\s+(\d+)\s+kB/);
  const availableBytes = availableMatch ? Number(availableMatch[1]) * 1024 : free;
  const memValue = {
    totalMb: Math.round(total / 1_048_576),
    freeMb: Math.round(free / 1_048_576),
    availableMb: Math.round(availableBytes / 1_048_576),
  };
  await persistRuntimeFact(
    pool,
    "memory",
    memValue,
    memValue.availableMb < 200 ? "WARN" : "INFO",
  );
  await recordWorldFact(pool, {
    entityKind: "runtime",
    entityId: "memory",
    predicate: "available",
    value: memValue,
    source: "/proc/meminfo",
    confidence: 0.99,
    ttlHours: 1,
  });
  if (memValue.availableMb < 300) {
    blockers.push(`Memory available ${memValue.availableMb}Mi — headless Chromium likely to OOM without --single-process.`);
  }
  facts++;

  // 4. Filesystem headroom.
  try {
    const s = statfsSync("/opt");
    const freeBytes = Number(s.bfree) * Number(s.bsize);
    const totalBytes = Number(s.blocks) * Number(s.bsize);
    const fsValue = {
      freeGb: Math.round(freeBytes / 1_073_741_824),
      totalGb: Math.round(totalBytes / 1_073_741_824),
      path: "/opt",
    };
    await persistRuntimeFact(pool, "fs_headroom", fsValue);
    facts++;
    if (fsValue.freeGb < 2) blockers.push(`/opt has ${fsValue.freeGb}Gb free — insufficient for Chromium install.`);
  } catch {
    // ok
  }

  // 5. Caddy admin API reachability (used to add inbound webhook routes).
  const caddy = probe("bash", ["-lc", "curl -sf -m 3 http://127.0.0.1:2019/config/ > /dev/null && echo up || echo down"]);
  await persistRuntimeFact(pool, "caddy_admin", {
    reachable: caddy.stdout.includes("up"),
    endpoint: "http://127.0.0.1:2019",
  });
  facts++;

  // 6. Provider secrets (presence only — never the value).
  const secrets = {
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET: !!process.env.RESEND_WEBHOOK_SECRET,
    ULTRON_INBOUND_TOKEN: !!process.env.ULTRON_INBOUND_TOKEN,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ULTRON_STRONG_MODEL: !!process.env.ULTRON_STRONG_MODEL,
  };
  await persistRuntimeFact(pool, "provider_secrets", secrets);
  await recordWorldFact(pool, {
    entityKind: "runtime",
    entityId: "secrets",
    predicate: "presence",
    value: secrets,
    source: "process.env",
    confidence: 1.0,
    ttlHours: 24,
  });
  facts++;

  logger("info", "ultron.runtime.diagnose", { facts, blockers });
  return { facts, blockers };
}

export async function latestRuntimeFacts(
  pool: pg.Pool,
): Promise<Record<string, unknown>> {
  const r = await pool.query(
    `select distinct on (probe) probe, value, observed_at, severity
       from ros_runtime_facts
       order by probe, observed_at desc`,
  );
  const out: Record<string, unknown> = {};
  for (const row of r.rows) out[row.probe] = { value: row.value, observedAt: row.observed_at, severity: row.severity };
  return out;
}
