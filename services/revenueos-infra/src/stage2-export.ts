/**
 * Stage 2: verified Supabase → local Postgres copy (no cutover).
 *
 * Reads SUPABASE_DB_URL / DATABASE_URL from env (never logs secrets).
 * Usage: npm run db -- stage2-export
 */
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { homedir } from "node:os";
import { resolvePaths } from "./paths.js";
import { assertPgInstalled, resolvePgBinaries } from "./pg-binaries.js";

const DRAFT_TABLES = [
  "revenueos_experiments",
  "revenueos_pursuits",
  "revenueos_pursuit_events",
  "revenueos_lessons",
  "revenueos_scorecards",
  "revenueos_leases",
  "revenueos_attributions",
  "revenueos_planner_runs",
  "revenueos_cycle_reports",
  "revenueos_exposures",
  "revenueos_discovery_doors",
  "revenueos_capability_gaps",
  "revenueos_channels",
  "revenueos_operator_claims",
] as const;

function loadDbUrl(): string {
  const url =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing SUPABASE_DB_URL / DATABASE_URL. Put direct Postgres URL in gitignored env.",
    );
  }
  if (url.includes("YOUR-PASSWORD")) {
    throw new Error("DATABASE URL still contains YOUR-PASSWORD placeholder");
  }
  return url;
}

function parseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || "5432",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "postgres",
  };
}

function psql(
  bins: ReturnType<typeof resolvePgBinaries>,
  remote: ReturnType<typeof parseUrl>,
  sql: string,
): string {
  const res = spawnSync(
    bins.psql,
    [
      "-h",
      remote.host,
      "-p",
      remote.port,
      "-U",
      remote.user,
      "-d",
      remote.database,
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      sql,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: remote.password },
    },
  );
  if (res.status !== 0) {
    throw new Error(`psql failed: ${(res.stderr || res.stdout || "").slice(0, 300)}`);
  }
  return (res.stdout || "").trim();
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on("data", (c) => hash.update(c));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

export async function stage2Export(): Promise<void> {
  const paths = resolvePaths();
  const bins = resolvePgBinaries(paths);
  assertPgInstalled(bins);
  const url = loadDbUrl();
  const remote = parseUrl(url);

  mkdirSync(paths.backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const existing = psql(
    bins,
    remote,
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'revenueos_%' ORDER BY 1`,
  )
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const tables = DRAFT_TABLES.filter((t) => existing.includes(t));
  const absent = DRAFT_TABLES.filter((t) => !existing.includes(t));
  const extras = existing.filter((t) => !(DRAFT_TABLES as readonly string[]).includes(t));
  const exportTables = [...new Set([...tables, ...extras])].sort();

  if (exportTables.length === 0) {
    throw new Error("No revenueos_* tables found on source");
  }

  const counts: Record<string, number> = {};
  for (const t of exportTables) {
    counts[t] = Number(psql(bins, remote, `SELECT count(*) FROM public."${t}"`));
  }

  const dump = path.join(paths.backups, `stage2-revenueos-${stamp}.dump`);
  const args = [
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "-h",
    remote.host,
    "-p",
    remote.port,
    "-U",
    remote.user,
    "-d",
    remote.database,
    "-f",
    dump,
  ];
  for (const t of exportTables) {
    args.push("-t", `public.${t}`);
  }

  console.log(`[stage2] exporting ${exportTables.length} tables → ${dump}`);
  const dumpRes = spawnSync(bins.pgDump, args, {
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: remote.password },
  });
  if (dumpRes.status !== 0) {
    throw new Error(`pg_dump failed: ${(dumpRes.stderr || "").slice(0, 400)}`);
  }

  const sha = await sha256File(dump);
  writeFileSync(`${dump}.sha256`, `${sha}  ${path.basename(dump)}\n`);

  const manifest = {
    stage: 2,
    createdAt: new Date().toISOString(),
    sourceHost: remote.host,
    sourceServerVersion: psql(bins, remote, "show server_version"),
    tables: exportTables,
    sourceRowCounts: counts,
    totalRows: Object.values(counts).reduce((a, b) => a + b, 0),
    dumpFile: dump,
    sha256: sha,
    draftAbsentOnSource: absent,
    extrasIncluded: extras,
  };
  const manifestPath = path.join(paths.backups, `stage2-export-manifest-${stamp}.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`[stage2] sha256=${sha}`);
  console.log(`[stage2] totalRows=${manifest.totalRows}`);
  console.log(`[stage2] manifest=${manifestPath}`);
}

/** Optional secrets file outside the repo. */
export function loadSecretsFile(): void {
  const candidates = [
    path.join(homedir(), ".revenueos", "secrets", "supabase-db.env"),
    path.join(homedir(), ".revenueos", "secrets", "local-pg.env"),
  ];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k && !(k in process.env)) process.env[k] = v;
    }
  }
}
