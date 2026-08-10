/**
 * Per-site runtime env — stored outside git, never shipped to clients.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

function secretsDir(dataDir: string) {
  return path.join(dataDir, "secrets");
}

function fileFor(dataDir: string, siteId: string) {
  return path.join(secretsDir(dataDir), `${siteId}.env.json`);
}

export function writeSiteEnv(
  dataDir: string,
  siteId: string,
  env: Record<string, string>,
) {
  mkdirSync(secretsDir(dataDir), { recursive: true });
  writeFileSync(fileFor(dataDir, siteId), JSON.stringify(env, null, 2), "utf8");
}

export function readSiteEnv(
  dataDir: string,
  siteId: string,
): Record<string, string> {
  const f = fileFor(dataDir, siteId);
  if (!existsSync(f)) return {};
  try {
    const raw = JSON.parse(readFileSync(f, "utf8")) as Record<string, string>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function clearSiteEnv(dataDir: string, siteId: string) {
  const f = fileFor(dataDir, siteId);
  if (existsSync(f)) unlinkSync(f);
}
