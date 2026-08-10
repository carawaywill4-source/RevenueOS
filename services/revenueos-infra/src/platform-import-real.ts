/**
 * REAL allowlisted platform import into native ros_* tables.
 * No live Core cutover. Stops safely on unresolved conflicts / unknown ownership.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { dbMigrate } from "./migrate.js";
import { resolvePaths } from "./paths.js";
import {
  collectPlatformImport,
  loadExpectedPortfolioIds,
  type ImportCandidate,
  type TargetTable,
} from "./platform-import-core.js";
import { writeStage2Checkpoint } from "./stage2-verify.js";

const BATCH = 200;

const IMPORT_TABLES: TargetTable[] = [
  "ros_businesses",
  "ros_experiments",
  "ros_pursuits",
  "ros_events",
  "ros_lessons",
  "ros_scorecards",
  "ros_claims",
  "ros_leases",
  "ros_channels",
  "ros_portfolio_state",
  "ros_activity",
  "ros_config_meta",
];

async function clearImportTargets(client: pg.Client): Promise<void> {
  // Only platform destination tables — never touch revenueos_* staging or mh_*.
  await client.query(`
    TRUNCATE TABLE
      ros_activity,
      ros_channels,
      ros_claims,
      ros_leases,
      ros_scorecards,
      ros_lessons,
      ros_events,
      ros_pursuits,
      ros_experiments,
      ros_portfolio_state,
      ros_businesses
    RESTART IDENTITY CASCADE
  `);
  await client.query(
    `delete from ros_config_meta where key in ('scheduler_checkpoint', 'platform_import_meta')`,
  );
}

async function insertBatch(
  client: pg.Client,
  target: TargetTable,
  rows: ImportCandidate[],
): Promise<number> {
  if (rows.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    if (target === "ros_businesses") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++}::jsonb,$${p++}::timestamptz,$${p++})`,
        );
        vals.push(
          r.site_id,
          r.display_name,
          r.industry,
          r.app_url,
          r.status,
          JSON.stringify(r.metadata ?? {}),
          r.updated_at,
          r.provenance,
        );
      }
      await client.query(
        `insert into ros_businesses
         (site_id, display_name, industry, app_url, status, metadata, updated_at, provenance)
         values ${places.join(",")}
         on conflict (site_id) do update set
           display_name=excluded.display_name, metadata=excluded.metadata,
           updated_at=excluded.updated_at, provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_experiments") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++},$${p++},$${p++}::jsonb,$${p++}::timestamptz,$${p++})`,
        );
        vals.push(
          r.id,
          r.site_id,
          r.category,
          r.status,
          JSON.stringify(r.document ?? {}),
          r.updated_at,
          r.provenance,
        );
      }
      await client.query(
        `insert into ros_experiments
         (id, site_id, category, status, document, updated_at, provenance)
         values ${places.join(",")}
         on conflict (id) do update set
           category=excluded.category, status=excluded.status,
           document=excluded.document, updated_at=excluded.updated_at,
           provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_pursuits") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++}::jsonb,$${p++}::timestamptz,$${p++})`,
        );
        vals.push(
          r.id,
          r.site_id,
          r.state,
          r.pattern_key,
          r.action_type,
          JSON.stringify(r.document ?? {}),
          r.updated_at,
          r.provenance,
        );
      }
      await client.query(
        `insert into ros_pursuits
         (id, site_id, state, pattern_key, action_type, document, updated_at, provenance)
         values ${places.join(",")}
         on conflict (id) do update set
           state=excluded.state, document=excluded.document,
           updated_at=excluded.updated_at, provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_events") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++},$${p++}::jsonb,$${p++}::timestamptz,$${p++})`,
        );
        vals.push(
          r.id,
          r.site_id,
          r.event_type,
          JSON.stringify(r.detail ?? {}),
          r.created_at,
          r.provenance,
        );
      }
      await client.query(
        `insert into ros_events
         (id, site_id, event_type, detail, created_at, provenance)
         values ${places.join(",")}
         on conflict (id) do update set
           detail=excluded.detail, provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_lessons") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++},$${p++}::jsonb,$${p++}::timestamptz,$${p++})`,
        );
        vals.push(
          r.id,
          r.site_id,
          r.summary,
          JSON.stringify(r.document ?? {}),
          r.updated_at,
          r.provenance,
        );
      }
      await client.query(
        `insert into ros_lessons
         (id, site_id, summary, document, updated_at, provenance)
         values ${places.join(",")}
         on conflict (id) do update set
           summary=excluded.summary, document=excluded.document,
           updated_at=excluded.updated_at, provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_scorecards") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++}::jsonb,$${p++}::timestamptz,$${p++})`,
        );
        vals.push(
          r.id,
          r.site_id,
          JSON.stringify(r.document ?? {}),
          r.updated_at,
          r.provenance,
        );
      }
      await client.query(
        `insert into ros_scorecards
         (id, site_id, document, updated_at, provenance)
         values ${places.join(",")}
         on conflict (id) do update set
           document=excluded.document, updated_at=excluded.updated_at,
           provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_channels") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++}::jsonb,$${p++},$${p++}::timestamptz,$${p++}::timestamptz)`,
        );
        vals.push(
          r.id,
          r.site_id,
          r.platform,
          r.account,
          r.capability_id,
          r.status,
          JSON.stringify(r.document ?? {}),
          r.provenance,
          r.created_at,
          r.updated_at,
        );
      }
      await client.query(
        `insert into ros_channels
         (id, site_id, platform, account, capability_id, status, document, provenance, created_at, updated_at)
         values ${places.join(",")}
         on conflict (id) do update set
           document=excluded.document, status=excluded.status,
           updated_at=excluded.updated_at, provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_leases") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++},$${p++}::timestamptz,$${p++}::jsonb,$${p++})`,
        );
        vals.push(
          r.id,
          r.site_id,
          r.owner,
          r.lease_until,
          JSON.stringify(r.document ?? {}),
          r.provenance,
        );
      }
      await client.query(
        `insert into ros_leases
         (id, site_id, owner, lease_until, document, provenance)
         values ${places.join(",")}
         on conflict (id) do update set
           owner=excluded.owner, lease_until=excluded.lease_until,
           document=excluded.document, provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_claims") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++}::timestamptz,$${p++}::timestamptz,$${p++})`,
        );
        vals.push(
          r.site_id,
          r.owner,
          r.lease_until,
          r.claimed_at,
          r.provenance,
        );
      }
      await client.query(
        `insert into ros_claims
         (site_id, owner, lease_until, claimed_at, provenance)
         values ${places.join(",")}
         on conflict (site_id) do update set
           owner=excluded.owner, lease_until=excluded.lease_until,
           claimed_at=excluded.claimed_at, provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_activity") {
      const vals: unknown[] = [];
      const places: string[] = [];
      let p = 1;
      for (const c of chunk) {
        const r = c.row;
        places.push(
          `($${p++},$${p++},$${p++}::timestamptz,$${p++},$${p++},$${p++}::jsonb,$${p++})`,
        );
        vals.push(
          r.id,
          r.site_id,
          r.at,
          r.summary,
          r.quality,
          JSON.stringify(r.detail ?? {}),
          r.provenance,
        );
      }
      await client.query(
        `insert into ros_activity
         (id, site_id, at, summary, quality, detail, provenance)
         values ${places.join(",")}
         on conflict (id) do update set
           summary=excluded.summary, detail=excluded.detail,
           provenance=excluded.provenance`,
        vals,
      );
    } else if (target === "ros_portfolio_state") {
      for (const c of chunk) {
        const r = c.row;
        await client.query(
          `insert into ros_portfolio_state (id, document, updated_at, provenance)
           values ($1,$2::jsonb,$3::timestamptz,$4)
           on conflict (id) do update set
             document=excluded.document, updated_at=excluded.updated_at,
             provenance=excluded.provenance`,
          [
            r.id,
            JSON.stringify(r.document ?? {}),
            r.updated_at,
            r.provenance,
          ],
        );
      }
    } else if (target === "ros_config_meta") {
      for (const c of chunk) {
        const r = c.row;
        await client.query(
          `insert into ros_config_meta (key, value, updated_at, provenance)
           values ($1,$2::jsonb,$3::timestamptz,$4)
           on conflict (key) do update set
             value=excluded.value, updated_at=excluded.updated_at,
             provenance=excluded.provenance`,
          [
            r.key,
            JSON.stringify(r.value ?? {}),
            r.updated_at,
            r.provenance,
          ],
        );
      }
    }
    n += chunk.length;
  }
  return n;
}

export async function runPlatformImportReal(): Promise<{
  reportPath: string;
  ok: boolean;
}> {
  const paths = resolvePaths();
  await dbMigrate();

  console.log("[import] collecting allowlisted platform candidates…");
  const { winners, stats, expectedBusinesses } = await collectPlatformImport();
  const expected =
    expectedBusinesses.length > 0
      ? expectedBusinesses
      : loadExpectedPortfolioIds();
  const missingBusinesses = expected.filter((b) => !stats.businessesSeen.has(b));

  if (stats.unknown > 0) {
    const report = {
      mode: "REAL_IMPORT_ABORTED",
      reason: "unknown_platform_ownership",
      unknown: stats.unknown,
      unknownSamples: stats.unknownSamples,
    };
    const reportPath = writeReport(paths.backups, report);
    writeStage2Checkpoint({
      platformImportReal: "FAIL",
      platformImportRealReport: reportPath,
    });
    console.error("[import] STOP — unknown ownership", stats.unknown);
    return { reportPath, ok: false };
  }
  if (stats.conflicts > 0) {
    const report = {
      mode: "REAL_IMPORT_ABORTED",
      reason: "unresolved_conflicts",
      conflicts: stats.conflicts,
      conflictSamples: stats.conflictSamples,
    };
    const reportPath = writeReport(paths.backups, report);
    writeStage2Checkpoint({
      platformImportReal: "FAIL",
      platformImportRealReport: reportPath,
    });
    console.error("[import] STOP — conflicts", stats.conflicts);
    return { reportPath, ok: false };
  }
  if (missingBusinesses.length > 0) {
    const report = {
      mode: "REAL_IMPORT_ABORTED",
      reason: "missing_businesses",
      missingBusinesses,
    };
    const reportPath = writeReport(paths.backups, report);
    writeStage2Checkpoint({
      platformImportReal: "FAIL",
      platformImportRealReport: reportPath,
    });
    console.error("[import] STOP — missing businesses", missingBusinesses);
    return { reportPath, ok: false };
  }

  const byTarget = new Map<TargetTable, ImportCandidate[]>();
  for (const t of IMPORT_TABLES) byTarget.set(t, []);
  for (const c of winners.values()) {
    if (!byTarget.has(c.target)) continue;
    byTarget.get(c.target)!.push(c);
  }

  const projected = { ...stats.projected };
  const client = new pg.Client({
    connectionString: paths.connectionUrl,
    connectionTimeoutMillis: 8_000,
  });
  await client.connect();

  const imported: Record<string, number> = {};
  try {
    await client.query("begin");
    await clearImportTargets(client);
    for (const t of IMPORT_TABLES) {
      const rows = byTarget.get(t) || [];
      console.log(`[import] writing ${t} (${rows.length})…`);
      imported[t] = await insertBatch(client, t, rows);
    }
    await client.query(
      `insert into ros_config_meta (key, value, updated_at, provenance)
       values ('platform_import_meta', $1::jsonb, now(), 'ENGINE_CHECKPOINT')
       on conflict (key) do update set value=excluded.value, updated_at=now()`,
      [
        JSON.stringify({
          importedAt: new Date().toISOString(),
          projected,
          imported,
          duplicatesDetected: stats.duplicatesDetected,
          newerLocalReplacements: stats.newerLocalReplacements,
          liveCutover: false,
        }),
      ],
    );
    await client.query("commit");
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore */
    }
    await client.end();
    throw err;
  }

  // Verification
  const counts: Record<string, number> = {};
  for (const t of [
    "ros_businesses",
    "ros_experiments",
    "ros_events",
    "ros_pursuits",
    "ros_leases",
    "ros_lessons",
    "ros_scorecards",
    "ros_channels",
    "ros_activity",
    "ros_portfolio_state",
    "ros_claims",
  ]) {
    const r = await client.query<{ n: string }>(`select count(*)::text as n from ${t}`);
    counts[t] = Number(r.rows[0]?.n ?? 0);
  }
  const cfg = await client.query(
    `select 1 from ros_config_meta where key='scheduler_checkpoint'`,
  );
  const port = await client.query(
    `select 1 from ros_portfolio_state where id='portfolio:engine-checkpoint'`,
  );
  const bizIds = await client.query<{ site_id: string }>(
    `select site_id from ros_businesses where status='active' order by site_id`,
  );
  const activeIds = bizIds.rows.map((r) => r.site_id);
  const missingActive = expected.filter((b) => !activeIds.includes(b));
  const historicalExtra = activeIds.filter((b) => !expected.includes(b));

  const mhTables = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema='public' and table_name like 'mh\\_%' escape '\\'`,
  );
  const mhInRos = await client.query(
    `select count(*)::int as n from (
       select 1 from ros_experiments where site_id='__mh_never__'
       union all select 1 from ros_businesses where site_id like 'mh\\_%' escape '\\'
     ) t`,
  );

  // InvoiceChaser presence
  const ic = await client.query(
    `select
       (select count(*)::int from ros_businesses where site_id='invoicechaser') as biz,
       (select count(*)::int from ros_experiments where site_id='invoicechaser') as exp,
       (select count(*)::int from ros_pursuits where site_id='invoicechaser') as pursuits,
       (select count(*)::int from ros_events where site_id='invoicechaser') as events,
       (select count(*)::int from ros_activity where site_id='invoicechaser') as activity`,
  );

  // Provenance distribution
  const prov = await client.query<{ provenance: string; n: string }>(
    `select provenance, count(*)::text as n from ros_experiments group by 1 order by 2 desc`,
  );

  const differences: Record<string, { projected: number; actual: number; delta: number }> =
    {};
  for (const [k, v] of Object.entries(projected)) {
    const actual = counts[k] ?? imported[k] ?? 0;
    differences[k] = { projected: v, actual, delta: actual - v };
  }

  const ok =
    missingActive.length === 0 &&
    historicalExtra.length === 0 &&
    mhTables.rowCount === 0 &&
    Number(cfg.rowCount) === 1 &&
    Number(port.rowCount) === 1 &&
    counts.ros_businesses === expected.length &&
    counts.ros_experiments > 0 &&
    counts.ros_pursuits > 0 &&
    counts.ros_events > 0 &&
    counts.ros_channels > 0 &&
    counts.ros_portfolio_state >= 1;

  const report = {
    mode: "REAL_IMPORT",
    createdAt: new Date().toISOString(),
    liveCutover: false,
    destructiveToStaging: false,
    denylistNeverImported: stats.denylistNeverImported,
    discoveredBySource: stats.discoveredBySource,
    classified: stats.classified,
    duplicatesDetected: stats.duplicatesDetected,
    conflicts: stats.conflicts,
    newerLocalReplacements: stats.newerLocalReplacements,
    unknown: stats.unknown,
    projected,
    imported,
    actualCounts: counts,
    dryRunVsActual: differences,
    businesses: {
      expectedCount: expected.length,
      activeCount: activeIds.length,
      missing: missingActive,
      accidentalHistoricalActive: historicalExtra,
      activeIds,
    },
    mendhausIsolation: {
      mhTablesInCore: mhTables.rows.map((r) => r.table_name),
      mhTablesCount: mhTables.rowCount ?? 0,
      mhNamedBusinesses: Number(mhInRos.rows[0]?.n ?? 0),
      pass: (mhTables.rowCount ?? 0) === 0,
    },
    invoiceChaser: ic.rows[0],
    schedulerCheckpointPresent: Number(cfg.rowCount) === 1,
    engineCheckpointPresent: Number(port.rowCount) === 1,
    experimentProvenance: prov.rows,
    gate: { pass: ok },
  };

  await client.end();

  const reportPath = writeReport(paths.backups, report);
  writeStage2Checkpoint({
    platformImportReal: ok ? "PASS" : "FAIL",
    platformImportRealReport: reportPath,
  });
  console.log("[import] report →", reportPath);
  console.log("[import] actualCounts", counts);
  console.log("[import] gate.pass", ok);
  return { reportPath, ok };
}

function writeReport(backups: string, report: unknown): string {
  mkdirSync(backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    backups,
    `platform-import-real-${stamp}.json`,
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  return reportPath;
}
