import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { RevenueOsPaths } from "./paths.js";

export type PgBinaries = {
  brew: string | null;
  pgCtl: string;
  initdb: string;
  psql: string;
  pgIsReady: string;
  postgres: string;
  pgDump: string;
  pgRestore: string;
  createdb: string;
  createuser: string;
  versionLabel: string;
};

function firstExisting(candidates: string[]): string | null {
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

function which(cmd: string): string | null {
  try {
    const out = execFileSync("which", [cmd], { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function prefixWithPgCtl(dir: string): string | null {
  if (existsSync(path.join(dir, "bin", "pg_ctl"))) return dir;
  if (existsSync(path.join(dir, "pg_ctl"))) return path.dirname(dir);
  return null;
}

/**
 * Resolve PostgreSQL binaries.
 * Prefers RevenueOS-managed conda-forge prefix, then Homebrew, then PATH.
 * Never Docker.
 */
export function resolvePgBinaries(paths: RevenueOsPaths): PgBinaries {
  const v = paths.pgVersion;
  const brew =
    firstExisting([
      path.join(paths.brewPrefix, "bin", "brew"),
      "/opt/homebrew/bin/brew",
      "/usr/local/bin/brew",
      which("brew") ?? "",
    ]) ?? null;

  let marked = "";
  const binPrefixFile = path.join(paths.home, "pg", "bin-prefix");
  if (existsSync(binPrefixFile)) {
    try {
      marked = readFileSync(binPrefixFile, "utf8").trim();
    } catch {
      marked = "";
    }
  }

  const candidates = [
    path.join(paths.home, "pg-prefix"),
    marked ? path.dirname(marked) : "",
    path.join(paths.home, "pg"),
    path.join(paths.brewPrefix, `opt/postgresql@${v}`),
    path.join(paths.brewPrefix, "opt/postgresql"),
    `/opt/homebrew/opt/postgresql@${v}`,
    `/opt/homebrew/opt/postgresql`,
    `/usr/local/opt/postgresql@${v}`,
    `/usr/local/opt/postgresql`,
  ].filter(Boolean);

  let prefix: string | null = null;
  for (const c of candidates) {
    const p = prefixWithPgCtl(c);
    if (p) {
      prefix = p;
      break;
    }
  }

  const bin = (name: string): string => {
    if (prefix) {
      const inPrefix = path.join(prefix, "bin", name);
      if (existsSync(inPrefix)) return inPrefix;
      const flat = path.join(prefix, name);
      if (existsSync(flat)) return flat;
    }
    const wrap = path.join(paths.home, "pg", "bin", name);
    if (existsSync(wrap)) return wrap;
    const w = which(name);
    if (w) return w;
    return name;
  };

  return {
    brew,
    pgCtl: bin("pg_ctl"),
    initdb: bin("initdb"),
    psql: bin("psql"),
    pgIsReady: bin("pg_isready"),
    postgres: bin("postgres"),
    pgDump: bin("pg_dump"),
    pgRestore: bin("pg_restore"),
    createdb: bin("createdb"),
    createuser: bin("createuser"),
    versionLabel: prefix
      ? `${path.basename(prefix)} (${prefix})`
      : `postgresql@${v} (unresolved)`,
  };
}

export function assertPgInstalled(bins: PgBinaries): void {
  if (!existsSync(bins.pgCtl)) {
    throw new Error(
      `PostgreSQL binaries not found (looked for pg_ctl). Run: revenueos db prepare`,
    );
  }
}
