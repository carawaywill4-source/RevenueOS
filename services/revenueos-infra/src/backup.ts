import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { resolvePaths } from "./paths.js";
import { assertPgInstalled, resolvePgBinaries } from "./pg-binaries.js";

export async function dbBackup(label?: string): Promise<string> {
  const paths = resolvePaths();
  const bins = resolvePgBinaries(paths);
  assertPgInstalled(bins);
  mkdirSync(paths.backups, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `revenueos-${label ?? "manual"}-${stamp}.dump`;
  const out = path.join(paths.backups, name);

  const res = spawnSync(
    bins.pgDump,
    [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      `--dbname=${paths.connectionUrl}`,
      `--file=${out}`,
    ],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    throw new Error(`pg_dump failed: ${res.stderr || res.stdout}`);
  }
  console.log(`[revenueos-infra] backup → ${out}`);
  return out;
}

export async function dbRestore(dumpPath: string): Promise<void> {
  const paths = resolvePaths();
  const bins = resolvePgBinaries(paths);
  assertPgInstalled(bins);

  const res = spawnSync(
    bins.pgRestore,
    [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      `--dbname=${paths.connectionUrl}`,
      dumpPath,
    ],
    { encoding: "utf8" },
  );
  // pg_restore returns non-zero for some notices; check stderr for FATAL
  if (res.status !== 0 && /FATAL|ERROR/.test(res.stderr || "")) {
    throw new Error(`pg_restore failed: ${res.stderr || res.stdout}`);
  }
  console.log(`[revenueos-infra] restore ← ${dumpPath}`);
}
