import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { PortfolioCompanyRecord, PortfolioManifest } from "./types.js";
import { manifestPath } from "./paths.js";

export function loadManifest(): PortfolioManifest | null {
  const p = manifestPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as PortfolioManifest;
  } catch {
    return null;
  }
}

export function saveManifest(manifest: PortfolioManifest): void {
  const p = manifestPath();
  mkdirSync(p.replace(/\/[^/]+$/, ""), { recursive: true });
  manifest.updated_at = new Date().toISOString();
  writeFileSync(p, JSON.stringify(manifest, null, 2) + "\n");
}

export function upsertCompany(
  manifest: PortfolioManifest,
  record: PortfolioCompanyRecord,
): PortfolioManifest {
  const idx = manifest.companies.findIndex((c) => c.id === record.id);
  if (idx >= 0) manifest.companies[idx] = record;
  else manifest.companies.push(record);
  saveManifest(manifest);
  return manifest;
}

export function countLive(manifest: PortfolioManifest) {
  const live = manifest.companies.filter((c) => c.current_stage === "LIVE");
  return {
    cashflow: live.filter((c) => c.portfolio_type === "cashflow").length,
    empire: live.filter((c) => c.portfolio_type === "empire").length,
    total: live.length,
  };
}

export function nextQueued(manifest: PortfolioManifest): PortfolioCompanyRecord | null {
  const active = manifest.companies.find(
    (c) =>
      c.current_stage !== "LIVE" &&
      c.current_stage !== "RETIRED" &&
      !["BUILDING", "TESTING", "DEPLOYING", "VERIFYING", "RESEARCHING", "DESIGNING"].includes(
        c.current_stage,
      ),
  );
  if (active) return active;

  const queued = manifest.companies.find((c) => c.current_stage === "QUEUED");
  if (queued) return queued;

  return manifest.companies.find((c) => c.current_stage === "RETRY") ?? null;
}

export function objectiveGap(manifest: PortfolioManifest) {
  const live = countLive(manifest);
  return {
    cashflow_needed: Math.max(0, manifest.objective.cashflow_live - live.cashflow),
    empire_needed: Math.max(0, manifest.objective.empire_live - live.empire),
    total_needed: Math.max(0, manifest.objective.total_live - live.total),
    live,
  };
}
