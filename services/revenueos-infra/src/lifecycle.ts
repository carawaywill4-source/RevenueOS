import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import pg from "pg";
import { resolvePaths, type RevenueOsPaths } from "./paths.js";
import { assertPgInstalled, resolvePgBinaries, type PgBinaries } from "./pg-binaries.js";

function run(
  bin: string,
  args: string[],
  opts?: { env?: NodeJS.ProcessEnv; input?: string },
): { status: number; stdout: string; stderr: string } {
  const res = spawnSync(bin, args, {
    encoding: "utf8",
    env: { ...process.env, ...opts?.env },
    input: opts?.input,
  });
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

function pgEnv(paths: RevenueOsPaths, bins: PgBinaries): NodeJS.ProcessEnv {
  return {
    PGDATA: paths.pgData,
    PGPORT: String(paths.port),
    PGHOST: "127.0.0.1",
    PGUSER: paths.user,
    PGDATABASE: paths.database,
    PATH: `${path.dirname(bins.pgCtl)}:${process.env.PATH ?? ""}`,
  };
}

function isRunning(bins: PgBinaries, paths: RevenueOsPaths): boolean {
  const res = run(bins.pgCtl, ["status", "-D", paths.pgData], {
    env: pgEnv(paths, bins),
  });
  return res.status === 0;
}

function ensureCluster(bins: PgBinaries, paths: RevenueOsPaths): void {
  if (existsSync(path.join(paths.pgData, "PG_VERSION"))) return;

  mkdirSync(paths.pgData, { recursive: true });
  mkdirSync(paths.pgRuntime, { recursive: true });

  console.log(`[revenueos-infra] initdb → ${paths.pgData}`);
  const init = run(
    bins.initdb,
    [
      "-D",
      paths.pgData,
      "-U",
      "postgres",
      "--auth-local=trust",
      "--auth-host=scram-sha-256",
      "--encoding=UTF8",
      "--locale=C",
    ],
    { env: pgEnv(paths, bins) },
  );
  if (init.status !== 0) {
    throw new Error(`initdb failed: ${init.stderr || init.stdout}`);
  }

  // Dedicated listen config for RevenueOS only
  const conf = path.join(paths.pgData, "postgresql.conf");
  const extras = `
# --- RevenueOS managed ---
listen_addresses = '127.0.0.1'
port = ${paths.port}
unix_socket_directories = '${paths.pgRuntime}'
logging_collector = off
log_destination = 'stderr'
max_connections = 40
shared_buffers = 128MB
# --- end RevenueOS ---
`;
  appendFileSync(conf, extras);

  const pwFile = path.join(paths.pgRuntime, "pwfile");
  const password = process.env.REVENUEOS_PG_PASSWORD ?? "revenueos_local_dev";
  writeFileSync(pwFile, password + "\n", { mode: 0o600 });

  // Bootstrap via Unix socket + local trust (no password prompt).
  const hba = path.join(paths.pgData, "pg_hba.conf");
  writeFileSync(
    hba,
    `# RevenueOS bootstrap
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
`,
  );

  const startTmp = run(
    bins.pgCtl,
    [
      "start",
      "-D",
      paths.pgData,
      "-l",
      paths.pgLog,
      "-o",
      `-p ${paths.port} -k ${paths.pgRuntime}`,
      "-w",
    ],
    { env: { ...pgEnv(paths, bins), PGUSER: "postgres" } },
  );
  if (startTmp.status !== 0) {
    throw new Error(`temp start failed: ${startTmp.stderr || startTmp.stdout}`);
  }

  try {
    const sock = paths.pgRuntime;
    const admin = [
      "-h",
      sock,
      "-p",
      String(paths.port),
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ];
    const setup = run(
      bins.psql,
      [
        ...admin,
        "-c",
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${paths.user}') THEN
             CREATE ROLE ${paths.user} LOGIN PASSWORD '${password.replace(/'/g, "''")}';
           END IF;
         END $$;`,
        "-c",
        `ALTER ROLE ${paths.user} WITH PASSWORD '${password.replace(/'/g, "''")}';`,
      ],
      { env: { ...pgEnv(paths, bins), PGUSER: "postgres" } },
    );
    if (setup.status !== 0) {
      throw new Error(`role setup failed: ${setup.stderr || setup.stdout}`);
    }

    const dbExists = run(
      bins.psql,
      [
        "-h",
        sock,
        "-p",
        String(paths.port),
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-tAc",
        `SELECT 1 FROM pg_database WHERE datname='${paths.database}'`,
      ],
      { env: { ...pgEnv(paths, bins), PGUSER: "postgres" } },
    );
    if (!dbExists.stdout.trim()) {
      const createdb = run(
        bins.psql,
        [
          ...admin,
          "-c",
          `CREATE DATABASE ${paths.database} OWNER ${paths.user};`,
          "-c",
          `GRANT ALL PRIVILEGES ON DATABASE ${paths.database} TO ${paths.user};`,
        ],
        { env: { ...pgEnv(paths, bins), PGUSER: "postgres" } },
      );
      if (createdb.status !== 0) {
        throw new Error(`create database failed: ${createdb.stderr || createdb.stdout}`);
      }
    }

    // Tighten TCP auth after bootstrap; keep local socket trust for ops.
    writeFileSync(
      hba,
      `# RevenueOS
local   all             all                                     trust
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
`,
    );
  } finally {
    run(bins.pgCtl, ["stop", "-D", paths.pgData, "-m", "fast", "-w"], {
      env: { ...pgEnv(paths, bins), PGUSER: "postgres" },
    });
  }
}

export async function dbStart(): Promise<void> {
  const paths = resolvePaths();
  const bins = resolvePgBinaries(paths);
  assertPgInstalled(bins);
  ensureCluster(bins, paths);

  if (isRunning(bins, paths)) {
    console.log(`[revenueos-infra] PostgreSQL already running on port ${paths.port}`);
    return;
  }

  mkdirSync(path.dirname(paths.pgLog), { recursive: true });
  const start = run(
    bins.pgCtl,
    [
      "start",
      "-D",
      paths.pgData,
      "-l",
      paths.pgLog,
      "-o",
      `-p ${paths.port} -k ${paths.pgRuntime}`,
      "-w",
    ],
    { env: pgEnv(paths, bins) },
  );
  if (start.status !== 0) {
    throw new Error(`pg_ctl start failed: ${start.stderr || start.stdout}`);
  }
  console.log(`[revenueos-infra] PostgreSQL started (port ${paths.port})`);
}

export async function dbStop(): Promise<void> {
  const paths = resolvePaths();
  const bins = resolvePgBinaries(paths);
  assertPgInstalled(bins);
  if (!existsSync(path.join(paths.pgData, "PG_VERSION"))) {
    console.log("[revenueos-infra] No cluster — nothing to stop");
    return;
  }
  if (!isRunning(bins, paths)) {
    console.log("[revenueos-infra] PostgreSQL already stopped");
    return;
  }
  const stop = run(bins.pgCtl, ["stop", "-D", paths.pgData, "-m", "fast", "-w"], {
    env: pgEnv(paths, bins),
  });
  if (stop.status !== 0) {
    throw new Error(`pg_ctl stop failed: ${stop.stderr || stop.stdout}`);
  }
  console.log("[revenueos-infra] PostgreSQL stopped");
}

export async function dbRestart(): Promise<void> {
  await dbStop();
  await dbStart();
}

export type DbHealthCli = {
  running: boolean;
  acceptingConnections: boolean;
  port: number;
  dataDir: string;
  versionLabel: string;
  latencyMs: number | null;
  detail?: string;
};

export async function dbHealth(): Promise<DbHealthCli> {
  const paths = resolvePaths();
  const bins = resolvePgBinaries(paths);
  const running =
    existsSync(bins.pgCtl) &&
    existsSync(path.join(paths.pgData, "PG_VERSION")) &&
    isRunning(bins, paths);

  let acceptingConnections = false;
  let latencyMs: number | null = null;
  let detail: string | undefined;

  if (running) {
    const started = Date.now();
    const ready = run(
      bins.pgIsReady,
      ["-h", "127.0.0.1", "-p", String(paths.port), "-d", paths.database],
      { env: pgEnv(paths, bins) },
    );
    acceptingConnections = ready.status === 0;
    if (acceptingConnections) {
      try {
        const client = new pg.Client({
          connectionString: paths.connectionUrl,
          connectionTimeoutMillis: 5_000,
        });
        await client.connect();
        await client.query("select 1");
        await client.end();
        latencyMs = Date.now() - started;
      } catch (err) {
        acceptingConnections = false;
        detail = err instanceof Error ? err.message : String(err);
      }
    } else {
      detail = ready.stderr || ready.stdout || "pg_isready_failed";
    }
  }

  return {
    running,
    acceptingConnections,
    port: paths.port,
    dataDir: paths.pgData,
    versionLabel: bins.versionLabel,
    latencyMs,
    detail,
  };
}
