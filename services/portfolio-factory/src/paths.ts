import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function dataDir() {
  return path.join(repoRoot(), ".data");
}

export function manifestPath() {
  return path.join(dataDir(), "portfolio-manifest.json");
}

export function lockPath() {
  return path.join(dataDir(), "portfolio-forge.lock");
}

export function workerLogPath() {
  return path.join(dataDir(), "portfolio-factory-worker.log");
}

export function appDir(siteId: string) {
  return path.join(repoRoot(), "apps", siteId);
}
