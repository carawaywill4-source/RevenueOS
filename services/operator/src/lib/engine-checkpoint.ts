/**
 * Durable Mac Core runtime checkpoint.
 * Survives process crash/LaunchAgent restart so unfinished schedule state resumes.
 * Does not replace pursuit ledgers — those live in ExperimentStore (file/Supabase).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { BusinessRuntimeStatus } from "./scheduler.js";

export type EngineCheckpoint = {
  version: 1;
  savedAt: string;
  authority: "mac";
  mode: string;
  businesses: BusinessRuntimeStatus[];
};

export function defaultCheckpointPath(repoRoot: string): string {
  return path.join(repoRoot, ".data", "operator-engine-checkpoint.json");
}

export function loadEngineCheckpoint(
  filePath: string,
): EngineCheckpoint | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as EngineCheckpoint;
    if (raw?.version !== 1 || !Array.isArray(raw.businesses)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveEngineCheckpoint(
  filePath: string,
  input: {
    mode: string;
    businesses: BusinessRuntimeStatus[];
  },
): void {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const doc: EngineCheckpoint = {
    version: 1,
    savedAt: new Date().toISOString(),
    authority: "mac",
    mode: input.mode,
    businesses: input.businesses,
  };
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(doc, null, 2) + "\n");
  renameSync(tmp, filePath);
}

/** Merge prior checkpoint into fresh status map (resume nextEligible / last tick). */
export function applyCheckpointToStatuses(
  statuses: Map<string, BusinessRuntimeStatus>,
  checkpoint: EngineCheckpoint | null,
): number {
  if (!checkpoint) return 0;
  let applied = 0;
  for (const row of checkpoint.businesses) {
    const cur = statuses.get(row.siteId);
    if (!cur) continue;
    statuses.set(row.siteId, {
      ...cur,
      ticks: row.ticks ?? cur.ticks,
      lastTickAt: row.lastTickAt ?? cur.lastTickAt,
      lastOk: row.lastOk ?? cur.lastOk,
      lastDurationMs: row.lastDurationMs ?? cur.lastDurationMs,
      lastExecuted: row.lastExecuted ?? cur.lastExecuted,
      lastEnqueued: row.lastEnqueued ?? cur.lastEnqueued,
      lastError: row.lastError ?? cur.lastError,
      nextEligibleAt: row.nextEligibleAt ?? cur.nextEligibleAt,
      // do not restore claimedUntil — leases must be re-acquired after restart
      claimedUntil: null,
    });
    applied += 1;
  }
  return applied;
}
