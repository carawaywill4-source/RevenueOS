/**
 * Native-only TEST RevenueOS Core instance (not LaunchAgent / live Core).
 * SUPABASE disabled; DATA_PROVIDER = NATIVE_POSTGRES.
 */
import { createPostgresData } from "@revenueos/data";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { dbHealth, dbRestart } from "./lifecycle.js";
import { resolvePaths } from "./paths.js";
import { loadExpectedPortfolioIds } from "./platform-import-core.js";
import { writeStage2Checkpoint } from "./stage2-verify.js";

function installSupabaseNetworkGuard(): {
  hit: boolean;
  hits: string[];
  restore: () => void;
} {
  const hits: string[] = [];
  const originalFetch = globalThis.fetch;
  const blocked = (url: string) => {
    const u = url.toLowerCase();
    return (
      u.includes("supabase.co") ||
      u.includes("supabase.in") ||
      u.includes("buvfllemxdvmwzhvfori") ||
      u.includes("fnrwzloovduhryynmgok")
    );
  };
  // @ts-expect-error test override
  globalThis.fetch = async (input: any, init?: any) => {
    const url =
      typeof input === "string"
        ? input
        : input?.url
          ? String(input.url)
          : String(input);
    if (blocked(url)) {
      hits.push(url);
      throw new Error(`SUPABASE_NETWORK_BLOCKED:${url}`);
    }
    return originalFetch(input, init);
  };
  // Ensure env cannot point adapters at Supabase
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_DB_URL;
  process.env.REVENUEOS_DATA_PROVIDER = "postgres";
  process.env.SUPABASE = "DISABLED";

  return {
    get hit() {
      return hits.length > 0;
    },
    hits,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

export async function runNativeCoreTest(): Promise<{
  reportPath: string;
  ok: boolean;
}> {
  const paths = resolvePaths();
  const guard = installSupabaseNetworkGuard();
  const expected = loadExpectedPortfolioIds();
  const data = createPostgresData(paths.connectionUrl);

  const checks: Record<string, unknown> = {};
  let ok = true;

  try {
    const health1 = await data.health();
    checks.healthBefore = health1;
    if (health1.state !== "DB_HEALTHY" && health1.state !== "DB_DEGRADED") {
      ok = false;
    }

    const businesses = await data.businesses.list("active");
    checks.businessCount = businesses.length;
    checks.businessIds = businesses.map((b) => b.siteId).sort();
    const missing = expected.filter(
      (id) => !businesses.some((b) => b.siteId === id),
    );
    checks.missingBusinesses = missing;
    if (businesses.length !== expected.length || missing.length) ok = false;

    const client = new pg.Client({ connectionString: paths.connectionUrl });
    await client.connect();
    const counts = await client.query(`
      select
        (select count(*)::int from ros_experiments) as experiments,
        (select count(*)::int from ros_pursuits) as pursuits,
        (select count(*)::int from ros_events) as events,
        (select count(*)::int from ros_leases) as leases,
        (select count(*)::int from ros_lessons) as lessons,
        (select count(*)::int from ros_scorecards) as scorecards,
        (select count(*)::int from ros_channels) as channels,
        (select count(*)::int from ros_activity) as activity,
        (select count(*)::int from ros_portfolio_state) as portfolio,
        (select count(*)::int from ros_config_meta where key='scheduler_checkpoint') as scheduler
    `);
    checks.loadedCounts = counts.rows[0];
    const c = counts.rows[0] as any;
    if (
      !(
        c.experiments > 0 &&
        c.pursuits > 0 &&
        c.events > 0 &&
        c.leases > 0 &&
        c.lessons > 0 &&
        c.scorecards > 0 &&
        c.channels > 0 &&
        c.activity > 0 &&
        c.portfolio >= 1 &&
        c.scheduler >= 1
      )
    ) {
      ok = false;
    }

    // Reconstruct scheduler/engine checkpoint from native PG
    const sched = await client.query(
      `select value from ros_config_meta where key='scheduler_checkpoint'`,
    );
    const port = await data.portfolio.get("portfolio:engine-checkpoint");
    checks.schedulerBusinesses = Array.isArray(
      (sched.rows[0]?.value as any)?.businesses,
    )
      ? (sched.rows[0].value as any).businesses.length
      : 0;
    checks.engineCheckpointLoaded = Boolean(port);
    if (!port || checks.schedulerBusinesses !== expected.length) ok = false;

    // Read sample domains for InvoiceChaser
    const icPursuits = await data.pursuits.listBySite("invoicechaser", 5);
    const icEvents = await data.events.listBySite("invoicechaser", {
      limit: 5,
    });
    const icLessons = await data.lessons.listBySite("invoicechaser", 5);
    const recent = await data.activity.listRecent(5);
    checks.invoiceChaser = {
      pursuits: icPursuits.length,
      events: icEvents.length,
      lessons: icLessons.length,
      recentActivitySample: recent.length,
    };
    if (icPursuits.length === 0 && icEvents.length === 0) ok = false;

    // Safe simulated test brain cycle — write TEST-only rows
    const cycleId = `native-test-cycle-${Date.now()}`;
    const now = new Date().toISOString();
    await data.withTransaction(async (tx) => {
      await tx.activity.append({
        id: `${cycleId}-activity`,
        siteId: "invoicechaser",
        at: now,
        summary: "native_test_brain_cycle",
        quality: "test",
        detail: {
          kind: "NATIVE_TEST_CYCLE",
          supabase: "DISABLED",
          provider: "NATIVE_POSTGRES",
        },
      });
      await tx.events.append({
        id: `${cycleId}-evt`,
        siteId: "invoicechaser",
        eventType: "native_test.brain_cycle",
        detail: { cycleId, ok: true },
        createdAt: now,
      });
      await tx.portfolio.upsert({
        id: "portfolio:native-test-cycle",
        document: {
          cycleId,
          at: now,
          businesses: expected.length,
          note: "test-only; live LaunchAgent unchanged",
        },
        updatedAt: now,
      });
    });
    checks.brainCycleWrite = "PASS";

    const written = await data.activity.listRecent(20);
    const found = written.some((a) => a.id === `${cycleId}-activity`);
    checks.brainCycleReadBack = found ? "PASS" : "FAIL";
    if (!found) ok = false;

    await client.end();
    await data.close();

    // Restart Postgres + reconnect test Core
    console.log("[native-test] restarting PostgreSQL…");
    await dbRestart();
    const hCluster = await dbHealth();
    checks.clusterAfterRestart = hCluster;

    const data2 = createPostgresData(paths.connectionUrl);
    let recovered = false;
    let health2 = await data2.health();
    for (let i = 0; i < 20; i++) {
      health2 = await data2.health();
      if (health2.state === "DB_HEALTHY" || health2.state === "DB_DEGRADED") {
        recovered = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    checks.healthAfterRestart = health2;
    checks.dbHealthyAfterRestart = recovered;
    if (!recovered) ok = false;

    const businesses2 = await data2.businesses.list("active");
    checks.businessesAfterRestart = businesses2.length;
    if (businesses2.length !== expected.length) ok = false;

    const port2 = await data2.portfolio.get("portfolio:engine-checkpoint");
    const testCycle = await data2.portfolio.get("portfolio:native-test-cycle");
    checks.portfolioRestored = Boolean(port2);
    checks.testCycleRestored = Boolean(testCycle);
    if (!port2 || !testCycle) ok = false;

    const client2 = new pg.Client({ connectionString: paths.connectionUrl });
    await client2.connect();
    const sched2 = await client2.query(
      `select value->>'savedAt' as saved_at from ros_config_meta where key='scheduler_checkpoint'`,
    );
    checks.schedulerRestored = Boolean(sched2.rows[0]?.saved_at);
    if (!sched2.rows[0]?.saved_at) ok = false;
    await client2.end();
    await data2.close();
  } catch (err) {
    ok = false;
    checks.error = err instanceof Error ? err.message : String(err);
  } finally {
    guard.restore();
  }

  checks.supabaseNetworkCallsObserved = guard.hit ? "YES" : "NO";
  checks.supabaseHits = guard.hits;
  if (guard.hit) ok = false;

  const report = {
    mode: "NATIVE_ONLY_TEST_CORE",
    createdAt: new Date().toISOString(),
    liveLaunchAgentChanged: false,
    supabase: "DISABLED",
    dataProvider: "NATIVE_POSTGRES",
    checks,
    gate: { pass: ok },
  };

  mkdirSync(paths.backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    paths.backups,
    `native-core-test-${stamp}.json`,
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  writeStage2Checkpoint({
    nativeCoreTest: ok ? "PASS" : "FAIL",
    nativeCoreTestReport: reportPath,
  });
  console.log("[native-test] report →", reportPath);
  console.log("[native-test] gate.pass", ok);
  console.log(
    "[native-test] supabaseNetworkCallsObserved",
    checks.supabaseNetworkCallsObserved,
  );
  return { reportPath, ok };
}
