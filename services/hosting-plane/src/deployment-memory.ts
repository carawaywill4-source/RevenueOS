/**
 * Deployment memory — every deploy is an experiment.
 * Persists to local JSON always; mirrors to Supabase when configured.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type DeploymentExperiment = {
  business_id: string;
  deployment_id: string;
  version: string;
  source_revision?: string;
  reason: string;
  hypothesis?: string;
  changes_made?: string;
  previous_metrics?: Record<string, unknown>;
  new_metrics?: Record<string, unknown>;
  errors?: string[];
  rollback_status?: "none" | "rolled_back" | "rollback_failed";
  commercial_outcome?: string;
  status: "DEPLOYMENT_FAILED" | "DEPLOYED" | "ROLLED_BACK" | "RETIRED" | "PAUSED";
  created_at: string;
  updated_at: string;
};

const CAT = "__ros_hosting_deployment__";

function localFile(dataDir: string) {
  return path.join(dataDir, "deployment-memory.json");
}

export function loadLocalMemory(dataDir: string): DeploymentExperiment[] {
  mkdirSync(dataDir, { recursive: true });
  const f = localFile(dataDir);
  if (!existsSync(f)) return [];
  try {
    const raw = JSON.parse(readFileSync(f, "utf8"));
    return Array.isArray(raw) ? (raw as DeploymentExperiment[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalMemory(dataDir: string, rows: DeploymentExperiment[]) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(localFile(dataDir), JSON.stringify(rows.slice(0, 2000), null, 2), "utf8");
}

export function recordDeployment(
  dataDir: string,
  exp: DeploymentExperiment,
  client?: SupabaseClient | null,
) {
  const rows = loadLocalMemory(dataDir);
  const idx = rows.findIndex((r) => r.deployment_id === exp.deployment_id);
  if (idx >= 0) rows[idx] = exp;
  else rows.unshift(exp);
  saveLocalMemory(dataDir, rows);

  if (client) {
    void Promise.resolve(
      client.from("revenueos_experiments").upsert(
        {
          id: `ros:hosting:deploy:${exp.deployment_id}`,
          site_id: exp.business_id,
          category: CAT,
          status: exp.status,
          document: exp,
          updated_at: exp.updated_at,
        },
        { onConflict: "id" },
      ),
    ).catch(() => undefined);
  }
}

export function createSupabaseFromEnv(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function improvedVsBaseline(exp: DeploymentExperiment): {
  answerable: boolean;
  improved: boolean | null;
  detail: string;
} {
  const prev = Number(exp.previous_metrics?.revenueUsd ?? NaN);
  const next = Number(exp.new_metrics?.revenueUsd ?? NaN);
  if (!Number.isFinite(prev) || !Number.isFinite(next)) {
    return {
      answerable: false,
      improved: null,
      detail: "insufficient_commercial_metrics",
    };
  }
  return {
    answerable: true,
    improved: next > prev,
    detail: `revenue ${prev} → ${next}`,
  };
}
