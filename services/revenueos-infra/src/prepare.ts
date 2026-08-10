import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { resolvePaths } from "./paths.js";
import { resolvePgBinaries } from "./pg-binaries.js";

function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv): void {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with status ${res.status}`);
  }
}

/**
 * Install native PostgreSQL without Docker and without requiring /opt/homebrew sudo.
 *
 * Strategy (in order):
 * 1. Reuse existing pg_ctl if already present (system Homebrew / prior prepare)
 * 2. Install relocatable PostgreSQL@15 via micromamba + conda-forge into ~/.revenueos/pg-prefix
 * 3. Optional: user-local Homebrew only if REVENUEOS_ALLOW_BREW_SOURCE=1 (slow; bottles need /opt/homebrew)
 *
 * Target major: 15 — compatible with Supabase cloud Postgres class; no blind major upgrade.
 */
export async function preparePostgres(): Promise<void> {
  const paths = resolvePaths();
  mkdirSync(paths.home, { recursive: true });
  mkdirSync(path.dirname(paths.configFile), { recursive: true });
  mkdirSync(paths.backups, { recursive: true });
  mkdirSync(paths.pgRuntime, { recursive: true });
  mkdirSync(path.dirname(paths.pgData), { recursive: true });

  let bins = resolvePgBinaries(paths);
  if (existsSync(bins.pgCtl)) {
    writeConfig(paths, bins.versionLabel, "existing-binaries");
    console.log(`[revenueos-infra] PostgreSQL already available: ${bins.versionLabel}`);
    return;
  }

  const prefix = process.env.REVENUEOS_PG_PREFIX ?? path.join(paths.home, "pg-prefix");
  await installViaMicromamba(paths.home, prefix, paths.pgVersion);

  // Point binary resolver at conda prefix by symlinking expected brew-style path
  // resolvePgBinaries also checks PATH / which — export via config + wrapper dir.
  const wrapBin = path.join(paths.home, "pg", "bin");
  mkdirSync(wrapBin, { recursive: true });
  linkBinaries(path.join(prefix, "bin"), wrapBin);

  // Ensure PATH resolution for this process
  process.env.PATH = `${wrapBin}:${path.join(prefix, "bin")}:${process.env.PATH ?? ""}`;
  bins = resolvePgBinaries(paths);
  if (!existsSync(bins.pgCtl)) {
    // Force absolute paths into a tiny shim directory that resolvePgBinaries finds via which
    // Also write explicit marker for lifecycle to use REVENUEOS_PG_BIN
    writeFileSync(
      path.join(paths.home, "pg", "bin-prefix"),
      path.join(prefix, "bin") + "\n",
    );
    bins = resolvePgBinaries(paths);
  }

  // Re-resolve with bin-prefix support (updated in pg-binaries)
  const pgCtl = path.join(prefix, "bin", "pg_ctl");
  if (!existsSync(pgCtl)) {
    throw new Error(`PostgreSQL install finished but pg_ctl missing at ${pgCtl}`);
  }

  writeConfig(paths, `postgresql@${paths.pgVersion} (conda-forge)`, "micromamba-conda-forge");
  console.log(`[revenueos-infra] PostgreSQL ready at ${prefix}`);
}

async function installViaMicromamba(
  home: string,
  prefix: string,
  pgVersion: string,
): Promise<void> {
  const microDir = path.join(home, "micromamba");
  const micromamba = path.join(microDir, "bin", "micromamba");
  mkdirSync(path.join(microDir, "bin"), { recursive: true });

  if (!existsSync(micromamba)) {
    console.log("[revenueos-infra] Downloading micromamba (user-local, no sudo)");
    const arch = process.arch === "arm64" ? "osx-arm64" : "osx-64";
    const url = `https://micro.mamba.pm/api/micromamba/${arch}/latest`;
    const dl = spawnSync(
      "bash",
      ["-lc", `curl -fsSL "${url}" | tar -xjv -C "${microDir}" bin/micromamba`],
      { stdio: "inherit" },
    );
    if (dl.status !== 0 || !existsSync(micromamba)) {
      throw new Error(
        "Failed to download/extract micromamba. Check network, then retry: revenueos db prepare",
      );
    }
    chmodSync(micromamba, 0o755);
  }

  if (existsSync(path.join(prefix, "bin", "pg_ctl"))) {
    console.log(`[revenueos-infra] Using existing prefix ${prefix}`);
    return;
  }

  console.log(
    `[revenueos-infra] Installing postgresql=${pgVersion} from conda-forge → ${prefix}`,
  );
  run(
    micromamba,
    [
      "create",
      "-y",
      "-p",
      prefix,
      "-c",
      "conda-forge",
      `postgresql=${pgVersion}`,
    ],
    {
      MAMBA_ROOT_PREFIX: path.join(home, "micromamba-root"),
    },
  );
}

function linkBinaries(fromDir: string, toDir: string): void {
  const names = [
    "pg_ctl",
    "initdb",
    "psql",
    "pg_isready",
    "postgres",
    "pg_dump",
    "pg_restore",
    "createdb",
    "createuser",
  ];
  for (const name of names) {
    const src = path.join(fromDir, name);
    const dest = path.join(toDir, name);
    if (!existsSync(src)) continue;
    if (existsSync(dest)) continue;
    spawnSync("ln", ["-sf", src, dest]);
  }
}

function writeConfig(
  paths: ReturnType<typeof resolvePaths>,
  versionLabel: string,
  runtime: string,
): void {
  const config = {
    provider: "postgres",
    runtime,
    pgVersionTarget: paths.pgVersion,
    pgVersionInstalled: versionLabel,
    dataDir: paths.pgData,
    port: paths.port,
    database: paths.database,
    user: paths.user,
    connectionUrlEnv: "REVENUEOS_DATABASE_URL",
    note:
      "Dedicated RevenueOS cluster. Not Docker. Supabase remains production until verified cutover.",
    preparedAt: new Date().toISOString(),
  };
  writeFileSync(paths.configFile, JSON.stringify(config, null, 2) + "\n");
  console.log(`[revenueos-infra] Wrote ${paths.configFile}`);
}
