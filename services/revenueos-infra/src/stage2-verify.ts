/**
 * Stage 2 verify + RevenueOS.Data local read/write probe + restart durability.
 * Does not touch Supabase writes. No production cutover.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createLegacyCopyData, createPostgresData } from "@revenueos/data";
import { resolvePaths } from "./paths.js";
import { assertPgInstalled, resolvePgBinaries } from "./pg-binaries.js";
import { dbHealth, dbRestart } from "./lifecycle.js";
import { loadSecretsFile } from "./stage2-export.js";

function loadLocalUrl(paths: ReturnType<typeof resolvePaths>): string {
  return process.env.REVENUEOS_DATABASE_URL || paths.connectionUrl;
}

export async function stage2DataProbe(): Promise<void> {
  loadSecretsFile();
  const paths = resolvePaths();
  const localUrl = loadLocalUrl(paths);
  const native = createPostgresData(localUrl);
  const legacy = createLegacyCopyData(localUrl);
  try {
    const health = await native.health();
    console.log(`[stage2] data.health=${health.state} latencyMs=${health.latencyMs}`);
    if (health.state !== "DB_HEALTHY" && health.state !== "DB_DEGRADED") {
      throw new Error(`unexpected_health:${health.state}`);
    }

    const businesses = await legacy.businesses.list();
    if (businesses.length < 1) throw new Error("legacy_business_list_empty");
    const siteId = businesses[0]!.siteId;
    const pursuits = await legacy.pursuits.listBySite(siteId, 5);
    const events = await legacy.events.listBySite(siteId, { limit: 5 });
    const lessons = await legacy.lessons.listBySite(siteId, 5);
    const scorecards = await legacy.scorecards.listBySite(siteId, 5);
    const activity = await legacy.activity.listRecent(5);
    const claim = await legacy.claims.get(siteId);
    console.log(
      `[stage2] legacy reads site=${siteId} pursuits=${pursuits.length} events=${events.length} lessons=${lessons.length} scorecards=${scorecards.length} activity=${activity.length} claim=${claim ? "hit" : "none"}`,
    );

    // Harmless local txn write on native ros_* only — never Supabase.
    const marker = `stage2-probe-${Date.now()}`;
    await native.withTransaction(async (tx) => {
      await tx.businesses.upsert({
        siteId: marker,
        displayName: "Stage2 Local Probe",
        status: "draft",
        appUrl: null,
        metadata: { stage2: true },
        updatedAt: new Date().toISOString(),
      });
      const got = await tx.businesses.get(marker);
      if (!got || got.displayName !== "Stage2 Local Probe") {
        throw new Error("local_txn_readback_failed");
      }
    });
    const bins = resolvePgBinaries(paths);
    assertPgInstalled(bins);
    const u = new URL(localUrl);
    const del = spawnSync(
      bins.psql,
      [
        "-h",
        u.hostname,
        "-p",
        u.port || "5432",
        "-U",
        decodeURIComponent(u.username),
        "-d",
        u.pathname.replace(/^\//, "") || "revenueos",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `delete from ros_businesses where site_id='${marker.replace(/'/g, "''")}'`,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PGPASSWORD: decodeURIComponent(u.password),
        },
      },
    );
    if (del.status !== 0) {
      throw new Error(`probe_cleanup_failed: ${(del.stderr || "").slice(0, 200)}`);
    }
    console.log("[stage2] local transactional write/read/cleanup PASS");
  } finally {
    await native.close();
    await legacy.close();
  }
}

export async function stage2RestartProof(): Promise<void> {
  loadSecretsFile();
  const paths = resolvePaths();
  const bins = resolvePgBinaries(paths);
  assertPgInstalled(bins);
  const localUrl = loadLocalUrl(paths);
  const u = new URL(localUrl);
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(u.password),
  };
  const before = spawnSync(
    bins.psql,
    [
      "-h",
      u.hostname,
      "-p",
      u.port || "5432",
      "-U",
      decodeURIComponent(u.username),
      "-d",
      u.pathname.replace(/^\//, "") || "revenueos",
      "-tAc",
      `select count(*)||'|'||coalesce((select id from revenueos_experiments order by updated_at desc nulls last limit 1),'')
       from revenueos_experiments`,
    ],
    { encoding: "utf8", env },
  );
  if (before.status !== 0) {
    throw new Error(`pre_restart_query_failed: ${(before.stderr || "").slice(0, 200)}`);
  }
  const beforeVal = (before.stdout || "").trim();
  console.log(`[stage2] pre-restart marker recorded`);

  await dbRestart();
  const data = createPostgresData(localUrl);
  try {
    let healthy = false;
    for (let i = 0; i < 15; i++) {
      const h = await data.health();
      if (h.state === "DB_HEALTHY" || h.state === "DB_DEGRADED") {
        healthy = true;
        console.log(`[stage2] post-restart health=${h.state}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!healthy) throw new Error("post_restart_health_failed");
  } finally {
    await data.close();
  }

  const after = spawnSync(
    bins.psql,
    [
      "-h",
      u.hostname,
      "-p",
      u.port || "5432",
      "-U",
      decodeURIComponent(u.username),
      "-d",
      u.pathname.replace(/^\//, "") || "revenueos",
      "-tAc",
      `select count(*)||'|'||coalesce((select id from revenueos_experiments order by updated_at desc nulls last limit 1),'')
       from revenueos_experiments`,
    ],
    { encoding: "utf8", env },
  );
  const afterVal = (after.stdout || "").trim();
  if (afterVal !== beforeVal) {
    throw new Error("restart_persistence_mismatch");
  }
  const h = await dbHealth();
  if (!h.running || !h.acceptingConnections) {
    throw new Error("db_health_cli_failed_after_restart");
  }
  console.log("[stage2] restart persistence PASS");
}

export function writeStage2Checkpoint(extra: Record<string, unknown>): void {
  const dir = path.join(homedirSafe(), ".revenueos", "backups");
  const file = path.join(dir, "stage2-checkpoint.json");
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  writeFileSync(
    file,
    JSON.stringify({ ...prev, ...extra, updatedAt: new Date().toISOString() }, null, 2) +
      "\n",
  );
  console.log(`[stage2] checkpoint → ${file}`);
}

function homedirSafe(): string {
  return process.env.HOME || process.env.USERPROFILE || "/tmp";
}
