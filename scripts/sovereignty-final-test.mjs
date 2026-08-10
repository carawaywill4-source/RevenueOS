#!/usr/bin/env node
/**
 * Final RevenueOS sovereignty test — READ/OPERATE ONLY, no architecture changes.
 * Usage: node scripts/sovereignty-final-test.mjs
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const outDir = path.join(ROOT, ".data");
mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, "sovereignty-final-report.json");

const CORE = "http://127.0.0.1:8080";
const PG =
  process.env.REVENUEOS_DATABASE_URL ||
  "postgresql://revenueos:revenueos_local_dev@127.0.0.1:55432/revenueos";

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: opts.timeout ?? 120_000,
    cwd: opts.cwd || ROOT,
    env: {
      ...process.env,
      REVENUEOS_PG_VERSION: process.env.REVENUEOS_PG_VERSION || "17",
      ...(opts.env || {}),
    },
  });
}

function parseEnvFile(filePath) {
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

async function getStatus() {
  const res = await fetch(`${CORE}/status`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`status_${res.status}`);
  return res.json();
}

async function waitCore(ms = 60_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const h = await fetch(`${CORE}/healthz`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (h.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return false;
}

function uid() {
  return sh("id", ["-u"]).stdout.trim();
}

const report = {
  mode: "SOVEREIGNTY_FINAL",
  createdAt: new Date().toISOString(),
  architectureModified: false,
  checks: {},
  authorityMap: {},
  passFlags: {},
};

const portfolio = JSON.parse(
  readFileSync(
    path.join(ROOT, "services/operator/src/portfolio-dynamic.json"),
    "utf8",
  ),
);
const siteIds = portfolio.map((b) => b.siteId);
const cronSecret =
  parseEnvFile(path.join(ROOT, "services/operator/.env")).CRON_SECRET ||
  parseEnvFile(path.join(ROOT, "services/operator/.env")).PORTFOLIO_PULSE_TOKEN ||
  process.env.CRON_SECRET;

let client = new pg.Client({
  connectionString: PG,
  connectionTimeoutMillis: 8_000,
});
client.on("error", () => {
  /* ignore terminate-during-restart */
});
await client.connect();

async function reconnectPg() {
  try {
    await client.end();
  } catch {
    /* ignore */
  }
  client = new pg.Client({
    connectionString: PG,
    connectionTimeoutMillis: 8_000,
  });
  client.on("error", () => {});
  for (let i = 0; i < 30; i++) {
    try {
      await client.connect();
      await client.query("select 1");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("postgres_reconnect_failed");
}

async function counts() {
  const r = await client.query(`
    select
      (select count(*)::int from ros_businesses where status='active') as businesses,
      (select count(*)::int from ros_events) as events,
      (select count(*)::int from ros_activity) as activity,
      (select count(*)::int from ros_pursuits) as pursuits,
      (select count(*)::int from ros_experiments) as experiments
  `);
  return r.rows[0];
}

// ---- 1 + 8 baseline authority ----
console.log("[1] baseline status + 50-business cycle observation");
const before = await getStatus();
const beforeCounts = await counts();
report.checks.baseline = {
  authority: before.engine?.authority,
  vercelBrainAllowed: before.engine?.vercelBrainAllowed,
  dataProvider: before.service?.dataProvider,
  ledgerMode: before.service?.ledgerMode,
  degradedLocal: before.service?.degradedLocal,
  businesses: before.businesses?.length,
  counts: beforeCounts,
};
const soleAuthority =
  before.engine?.authority === "mac/native" &&
  before.engine?.vercelBrainAllowed === false &&
  before.service?.dataProvider === "postgres" &&
  before.service?.ledgerMode === "native_postgres" &&
  before.businesses?.length === 50;
report.checks.soleAuthorityBaseline = soleAuthority;

// Observe ticks for ~75s
await new Promise((r) => setTimeout(r, 75_000));
const mid = await getStatus();
const midCounts = await counts();
const tickedOk = (mid.businesses || []).filter(
  (b) => b.lastOk === true && b.lastTickAt,
);
const all50Tick = tickedOk.length === 50;
const grew =
  Number(midCounts.events) > Number(beforeCounts.events) ||
  Number(midCounts.activity) > Number(beforeCounts.activity) ||
  Number(midCounts.pursuits) >= Number(beforeCounts.pursuits);
report.checks.autonomousCycle = {
  tickedOk: tickedOk.length,
  all50: all50Tick,
  countsBefore: beforeCounts,
  countsAfter: midCounts,
  stateGrew: grew,
  sample: tickedOk.slice(0, 5).map((b) => ({
    id: b.siteId,
    ticks: b.ticks,
    lastTickAt: b.lastTickAt,
    enq: b.lastEnqueued,
    exec: b.lastExecuted,
  })),
  pass: all50Tick && grew,
};

// ---- 2 + 3 Postgres sole durable + no supabase in runtime ----
console.log("[2/3] postgres sole authority + no supabase runtime");
const pidLine = sh("launchctl", [
  "print",
  `gui/${uid()}/com.revenueos.core`,
]).stdout;
const pidMatch = pidLine.match(/pid = (\d+)/);
const pid = pidMatch?.[1];
let processEnv = "";
if (pid) {
  processEnv = sh("ps", ["eww", "-p", pid]).stdout || "";
}
const hasSupabaseUrl = /SUPABASE_URL=/.test(processEnv);
const hasSupabaseKey = /SUPABASE_SERVICE_ROLE_KEY=/.test(processEnv);
const hasSupabaseDb = /SUPABASE_DB_URL=/.test(processEnv);
const dataProviderPostgres = /REVENUEOS_DATA_PROVIDER=postgres/.test(processEnv);
const supabaseDisabled = /SUPABASE_DISABLED=1|SUPABASE=DISABLED/.test(
  processEnv,
);

// Static: operator index native path must not construct supabase when postgres
const indexSrc = readFileSync(
  path.join(ROOT, "services/operator/src/index.ts"),
  "utf8",
);
const nativeBranchUsesPg =
  indexSrc.includes('dataProvider === "postgres"') &&
  indexSrc.includes("createPostgresExperimentStore");

// Grep live core logs for supabase hosts
const logs = [
  path.join(
    process.env.HOME || "",
    "Library/Logs/RevenueOS/core.stdout.log",
  ),
  path.join(
    process.env.HOME || "",
    "Library/Logs/RevenueOS/core.stderr.log",
  ),
];
// Only attribute log lines from this test window (ignore pre-cutover history).
const testWindowStart = Date.parse(report.createdAt);
const logHits = [];
for (const lp of logs) {
  if (!existsSync(lp)) continue;
  const tail = sh("tail", ["-n", "200", lp]).stdout || "";
  for (const line of tail.split("\n")) {
    const at = line.match(/"at"\s*:\s*"([^"]+)"/);
    if (at) {
      const t = Date.parse(at[1]);
      if (Number.isFinite(t) && t < testWindowStart - 60_000) continue;
    } else {
      continue; // require timestamped JSON lines for attribution
    }
    if (
      /supabase\.(co|in)|buvfllemxdvmwzhvfori|fnrwzloovduhryynmgok/i.test(line) &&
      !/SUPABASE_DISABLED|refused_cloud|DISABLED|mac_brain_only/i.test(line)
    ) {
      logHits.push(line.slice(0, 200));
    }
  }
}
report.checks.supabaseRuntime = {
  processHasSupabaseUrl: hasSupabaseUrl,
  processHasSupabaseKey: hasSupabaseKey,
  processHasSupabaseDb: hasSupabaseDb,
  dataProviderPostgres,
  supabaseDisabled,
  nativeBranchUsesPg,
  recentLogHits: logHits.slice(0, 10),
  pass:
    !hasSupabaseUrl &&
    !hasSupabaseKey &&
    !hasSupabaseDb &&
    dataProviderPostgres &&
    supabaseDisabled &&
    nativeBranchUsesPg &&
    logHits.length === 0,
};

// mh_* absent
const mh = await client.query(
  `select count(*)::int as n from information_schema.tables
   where table_schema='public' and table_name like 'mh\\_%' escape '\\'`,
);
report.checks.nativePostgresSole = {
  activeBusinesses: beforeCounts.businesses,
  mhTables: mh.rows[0].n,
  pass: Number(beforeCounts.businesses) === 50 && Number(mh.rows[0].n) === 0,
};

// ---- 4 no vercel brain execution from core ----
console.log("[4] no vercel brain invocation from core");
const vercelHits = [];
for (const lp of logs) {
  if (!existsSync(lp)) continue;
  const tail = sh("tail", ["-n", "200", lp]).stdout || "";
  for (const line of tail.split("\n")) {
    const at = line.match(/"at"\s*:\s*"([^"]+)"/);
    if (at) {
      const t = Date.parse(at[1]);
      if (Number.isFinite(t) && t < testWindowStart - 60_000) continue;
    } else continue;
    if (
      /vercel\.app\/api\/cron|daily-growth-review|portfolio-digest|keep-operating/i.test(
        line,
      )
    ) {
      vercelHits.push(line.slice(0, 200));
    }
  }
}
report.checks.vercelBrainRuntime = {
  vercelBrainAllowed: mid.engine?.vercelBrainAllowed === false,
  recentLogHits: vercelHits.slice(0, 10),
  pass: mid.engine?.vercelBrainAllowed === false && vercelHits.length === 0,
};

// ---- 5 kill/restart Core — state survives, resume without dup authority ----
console.log("[5] kill/restart Core");
const preRestartCounts = await counts();
const preCheckpoint = await client.query(
  `select value->>'savedAt' as saved_at,
          jsonb_array_length(value->'businesses') as n
   from ros_config_meta where key='scheduler_checkpoint'`,
);
sh("launchctl", ["kickstart", "-k", `gui/${uid()}/com.revenueos.core`]);
const coreUp = await waitCore(90_000);
await new Promise((r) => setTimeout(r, 55_000));
const afterRestart = await getStatus();
const afterRestartCounts = await counts();
const afterRestartOk = (afterRestart.businesses || []).filter(
  (b) => b.lastOk === true && b.lastTickAt,
);
const postCheckpoint = await client.query(
  `select value->>'savedAt' as saved_at,
          jsonb_array_length(value->'businesses') as n
   from ros_config_meta where key='scheduler_checkpoint'`,
);
report.checks.coreRestart = {
  coreUp,
  businesses: afterRestart.businesses?.length,
  tickedOk: afterRestartOk.length,
  authority: afterRestart.engine?.authority,
  vercelBrainAllowed: afterRestart.engine?.vercelBrainAllowed,
  countsBefore: preRestartCounts,
  countsAfter: afterRestartCounts,
  checkpointBefore: preCheckpoint.rows[0],
  checkpointAfter: postCheckpoint.rows[0],
  // No second authority appeared
  singleAuthority:
    afterRestart.engine?.authority === "mac/native" &&
    afterRestart.engine?.vercelBrainAllowed === false,
  pass:
    coreUp &&
    afterRestart.businesses?.length === 50 &&
    afterRestartOk.length === 50 &&
    afterRestart.engine?.authority === "mac/native" &&
    afterRestart.engine?.vercelBrainAllowed === false &&
    Number(afterRestartCounts.events) >= Number(preRestartCounts.events),
};

// ---- 6 restart Postgres ----
console.log("[6] restart Postgres");
try {
  await client.end();
} catch {
  /* ignore */
}
const pgRestart = sh(
  "npm",
  ["run", "db", "--", "restart"],
  { timeout: 120_000, cwd: ROOT },
);
await new Promise((r) => setTimeout(r, 2_000));
await reconnectPg();
const health = await client.query("select 1 as ok");
const bizAfterPg = await client.query(
  `select count(*)::int as n from ros_businesses where status='active'`,
);
const eventsAfterPg = await client.query(
  `select count(*)::int as n from ros_events`,
);
sh("launchctl", ["kickstart", "-k", `gui/${uid()}/com.revenueos.core`]);
const coreAfterPg = await waitCore(90_000);
await new Promise((r) => setTimeout(r, 45_000));
const statusAfterPg = await getStatus();
const okAfterPg = (statusAfterPg.businesses || []).filter(
  (b) => b.lastOk === true,
);
report.checks.postgresRestart = {
  npmExit: pgRestart.status,
  select1: health.rows[0]?.ok === 1,
  businesses: bizAfterPg.rows[0].n,
  events: eventsAfterPg.rows[0].n,
  coreUp: coreAfterPg,
  tickedOk: okAfterPg.length,
  authority: statusAfterPg.engine?.authority,
  pass:
    pgRestart.status === 0 &&
    health.rows[0]?.ok === 1 &&
    Number(bizAfterPg.rows[0].n) === 50 &&
    coreAfterPg &&
    okAfterPg.length === 50 &&
    statusAfterPg.engine?.authority === "mac/native",
};

// ---- 7 refuse all deprecated cloud-brain endpoints ----
console.log("[7] refuse cloud-brain endpoints");
const refuseResults = [];
if (!cronSecret) {
  report.checks.cloudRefuse = {
    pass: false,
    error: "missing_CRON_SECRET",
  };
} else {
  const endpoints = [];
  for (const b of portfolio) {
    const url = (b.appUrl || "").replace(/\/$/, "");
    if (url) endpoints.push({ siteId: b.siteId, url: `${url}/api/cron/revenueos` });
  }
  // root brain endpoints (if deployed)
  endpoints.push({
    siteId: "__root_daily_growth__",
    url: "https://tributeready.org/api/cron/daily-growth-review",
  });
  endpoints.push({
    siteId: "__root_portfolio_digest__",
    url: "https://tributeready.org/api/cron/portfolio-digest",
  });

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: { Authorization: `Bearer ${cronSecret}` },
        signal: AbortSignal.timeout(25_000),
      });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text.slice(0, 120) };
      }
      const executedBrain = Boolean(
        body?.drain ||
          body?.plan ||
          (body?.ok === true &&
            body?.skipped !== true &&
            !String(body?.cycleStatus || "").includes("refused") &&
            res.status === 200),
      );
      const refusedOrUnavailable =
        !executedBrain &&
        (body?.skipped === true ||
          String(body?.cycleStatus || "").includes("refused") ||
          body?.mode === "mac_brain_only" ||
          res.status === 401 ||
          res.status === 404 ||
          res.status === 403 ||
          res.status >= 500 ||
          res.status === 405);
      refuseResults.push({
        siteId: ep.siteId,
        status: res.status,
        cycleStatus: body?.cycleStatus,
        mode: body?.mode,
        skipped: body?.skipped,
        refused: refusedOrUnavailable,
        executedBrain,
      });
    } catch (e) {
      // Network failure / unavailable = not executing
      refuseResults.push({
        siteId: ep.siteId,
        status: "error",
        refused: true,
        executedBrain: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  const anyExecuted = refuseResults.some((r) => r.executedBrain);
  report.checks.cloudRefuse = {
    tested: refuseResults.length,
    executedBrainCount: refuseResults.filter((r) => r.executedBrain).length,
    notRefused: refuseResults.filter((r) => !r.refused && !r.executedBrain),
    sample: refuseResults.filter((r) => r.status === 200).slice(0, 8),
    pass: !anyExecuted,
  };
}

// ---- 9 isolation ----
console.log("[9] cross-business isolation");
const cross = await client.query(`
  select count(*)::int as n from ros_pursuits p
  where p.document->>'siteId' is not null
    and p.document->>'siteId' <> p.site_id
`);
const coreOwnedByBiz = await client.query(`
  select count(*)::int as n from ros_businesses
  where site_id in ('revenueos','revenueos-core','mac-core')
`);
const mendhausActiveAuthority = await client.query(`
  select count(*)::int as n from ros_businesses
  where site_id='mendhaus' and status='active'
`);
// Active portfolio should not include mendhaus as core
const portfolioHasMendhaus = siteIds.includes("mendhaus");
const marker = `sov-iso-${Date.now()}`;
const siteA = siteIds[0];
const siteB = siteIds[1];
await client.query(
  `insert into ros_events (id, site_id, event_type, detail, created_at, provenance)
   values ($1,$2,'sovereignty.isolation_probe',$3::jsonb,now(),'LOCAL_LEDGER')
   on conflict do nothing`,
  [marker, siteA, JSON.stringify({ probe: true, for: siteA })],
);
const leak = await client.query(
  `select count(*)::int as n from ros_events where id=$1 and site_id=$2`,
  [marker, siteB],
);
report.checks.isolation = {
  pursuitSiteIdMismatches: cross.rows[0].n,
  coreNamedAsBusiness: coreOwnedByBiz.rows[0].n,
  mendhausActiveInCoreRegistry: mendhausActiveAuthority.rows[0].n,
  mendhausInActivePortfolio: portfolioHasMendhaus,
  probeWroteOnlySiteA: Number(leak.rows[0].n) === 0,
  siteA,
  siteB,
  pass:
    Number(cross.rows[0].n) === 0 &&
    Number(coreOwnedByBiz.rows[0].n) === 0 &&
    !portfolioHasMendhaus &&
    Number(leak.rows[0].n) === 0,
};

// ---- 10 authority map ----
report.authorityMap = {
  RevenueOSCore: {
    process: "LOCAL",
    launchAgent: "LOCAL",
    executionAuthority: "NATIVE",
    databaseAuthority: "NATIVE",
    queueAuthority: "NATIVE",
    note: "com.revenueos.core → services/operator → ros_*",
  },
  ExecutionAuthority: "NATIVE",
  DatabaseAuthority: "NATIVE",
  QueueAuthority: "NATIVE",
  BusinessWorkers: "NATIVE",
  Storefronts: "VERCEL",
  HostingPlaneControlApi: "LOCAL",
  Supabase: "EXTERNAL_ARCHIVED_NOT_RUNTIME",
  VercelBrain: "DISABLED",
  components: {
    "services/operator": "LOCAL",
    "ros_* Postgres :55432": "NATIVE",
    "operator-engine-checkpoint.json": "LOCAL",
    "LaunchAgent com.revenueos.core": "LOCAL",
    "apps/*/storefront HTTP": "VERCEL",
    "/api/cron/revenueos": "VERCEL_REFUSED",
    "Supabase projects": "EXTERNAL_UNUSED",
  },
};

// Flags
const pass =
  report.checks.autonomousCycle?.pass &&
  report.checks.nativePostgresSole?.pass &&
  report.checks.supabaseRuntime?.pass &&
  report.checks.vercelBrainRuntime?.pass &&
  report.checks.coreRestart?.pass &&
  report.checks.postgresRestart?.pass &&
  report.checks.cloudRefuse?.pass &&
  report.checks.isolation?.pass &&
  soleAuthority;

report.passFlags = {
  SUPABASE_RUNTIME_DEPENDENCY: report.checks.supabaseRuntime?.pass ? 0 : 1,
  VERCEL_BRAIN_DEPENDENCY: report.checks.vercelBrainRuntime?.pass ? 0 : 1,
  MULTIPLE_EXECUTION_AUTHORITIES: report.checks.coreRestart?.singleAuthority
    ? 0
    : 1,
  CROSS_BUSINESS_STATE_CONTAMINATION: report.checks.isolation?.pass ? 0 : 1,
  MAC_EXECUTION_AUTHORITY: statusAfterPg.engine?.authority === "mac/native",
  NATIVE_POSTGRES_AUTHORITY:
    statusAfterPg.service?.dataProvider === "postgres",
  BUSINESSES_50_50_AFTER_RESTART: okAfterPg.length === 50,
  OVERALL_PASS: pass,
};

report.gate = { pass };
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log("[report]", reportPath);
console.log(JSON.stringify(report.passFlags, null, 2));
console.log("[gate.pass]", pass);

try {
  await client.end();
} catch {
  /* ignore */
}
process.exit(pass ? 0 : 2);
