/**
 * Local hosting-plane state — survives Core restarts.
 * Optional Supabase sync for deployment memory (see deployment-memory.ts).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SiteRuntimeRecord } from "./runtime/types.js";
import type { HostCapacity } from "./resource-governor.js";
import { DEFAULT_CAPACITY } from "./resource-governor.js";

export type HostingPlaneState = {
  version: 1;
  capacity: HostCapacity;
  sites: SiteRuntimeRecord[];
  nextPort: number;
  updatedAt: string;
  mode: "development" | "production";
  audit: Array<{
    at: string;
    action: string;
    siteId?: string;
    detail: string;
    actor: "system" | "owner" | "core";
  }>;
};

const DEFAULT_STATE = (): HostingPlaneState => ({
  version: 1,
  capacity: { ...DEFAULT_CAPACITY },
  sites: [],
  nextPort: 9100,
  updatedAt: new Date().toISOString(),
  mode: "development",
  audit: [],
});

export function statePath(dataDir: string) {
  return path.join(dataDir, "hosting-plane-state.json");
}

export function loadState(dataDir: string): HostingPlaneState {
  mkdirSync(dataDir, { recursive: true });
  const file = statePath(dataDir);
  if (!existsSync(file)) return DEFAULT_STATE();
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as HostingPlaneState;
    if (!raw || raw.version !== 1 || !Array.isArray(raw.sites)) return DEFAULT_STATE();
    return {
      ...DEFAULT_STATE(),
      ...raw,
      capacity: { ...DEFAULT_CAPACITY, ...(raw.capacity ?? {}) },
      sites: raw.sites.map((s) => ({
        ...s,
        domains: Array.isArray(s.domains)
          ? s.domains
          : s.domain
            ? [s.domain]
            : [],
      })),
    };
  } catch {
    return DEFAULT_STATE();
  }
}

export function saveState(dataDir: string, state: HostingPlaneState) {
  mkdirSync(dataDir, { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(statePath(dataDir), JSON.stringify(state, null, 2), "utf8");
}

export function audit(
  state: HostingPlaneState,
  action: string,
  detail: string,
  opts?: { siteId?: string; actor?: "system" | "owner" | "core" },
) {
  state.audit.unshift({
    at: new Date().toISOString(),
    action,
    siteId: opts?.siteId,
    detail: detail.slice(0, 500),
    actor: opts?.actor ?? "system",
  });
  state.audit = state.audit.slice(0, 500);
}
