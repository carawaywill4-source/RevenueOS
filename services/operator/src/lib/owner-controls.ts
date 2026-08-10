/**
 * Persisted owner control plane for RevenueOSCore.
 * Pause / resume / prioritize — does not erase learning or queues.
 * Claims remain held while paused so Vercel cannot resume autonomy.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type OwnerControlState = {
  portfolioPaused: boolean;
  pausedBusinesses: string[];
  prioritizedBusinesses: string[];
  updatedAt: string;
  updatedBy: string;
};

export type OwnerControlAudit = {
  id: string;
  at: string;
  command: string;
  target: string | null;
  detail: string;
  actor: string;
};

const STATE_ID = "ros:owner_control:portfolio";
const STATE_CATEGORY = "__ros_owner_control__";
const AUDIT_CATEGORY = "__ros_owner_control_audit__";

const DEFAULT_STATE: OwnerControlState = {
  portfolioPaused: false,
  pausedBusinesses: [],
  prioritizedBusinesses: [],
  updatedAt: new Date(0).toISOString(),
  updatedBy: "system",
};

export async function loadOwnerControls(
  client: SupabaseClient,
): Promise<OwnerControlState> {
  const { data } = await client
    .from("revenueos_experiments")
    .select("document")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (!data?.document || typeof data.document !== "object") {
    return { ...DEFAULT_STATE };
  }
  const doc = data.document as Partial<OwnerControlState>;
  return {
    portfolioPaused: Boolean(doc.portfolioPaused),
    pausedBusinesses: Array.isArray(doc.pausedBusinesses)
      ? doc.pausedBusinesses.map(String)
      : [],
    prioritizedBusinesses: Array.isArray(doc.prioritizedBusinesses)
      ? doc.prioritizedBusinesses.map(String)
      : [],
    updatedAt: String(doc.updatedAt ?? DEFAULT_STATE.updatedAt),
    updatedBy: String(doc.updatedBy ?? "system"),
  };
}

async function saveOwnerControls(
  client: SupabaseClient,
  state: OwnerControlState,
): Promise<void> {
  await client.from("revenueos_experiments").upsert(
    {
      id: STATE_ID,
      site_id: "portfolio",
      category: STATE_CATEGORY,
      status: state.portfolioPaused ? "paused" : "active",
      document: state,
      updated_at: state.updatedAt,
    },
    { onConflict: "id" },
  );
}

async function audit(
  client: SupabaseClient,
  entry: Omit<OwnerControlAudit, "id">,
): Promise<void> {
  const id = `ros:ocaudit:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await client.from("revenueos_experiments").upsert(
    {
      id,
      site_id: "portfolio",
      category: AUDIT_CATEGORY,
      status: "recorded",
      document: { ...entry, id },
      updated_at: entry.at,
    },
    { onConflict: "id" },
  );
}

export type ControlCommand =
  | "pause_revenueos"
  | "resume_revenueos"
  | "pause_business"
  | "resume_business"
  | "prioritize_business";

export async function applyOwnerControl(input: {
  client: SupabaseClient;
  command: ControlCommand;
  siteId?: string;
  actor?: string;
}): Promise<{ ok: boolean; state: OwnerControlState; detail: string }> {
  const actor = input.actor ?? "owner";
  const at = new Date().toISOString();
  const state = await loadOwnerControls(input.client);
  const siteId = input.siteId?.trim() || null;

  switch (input.command) {
    case "pause_revenueos":
      state.portfolioPaused = true;
      break;
    case "resume_revenueos":
      state.portfolioPaused = false;
      break;
    case "pause_business":
      if (!siteId) return { ok: false, state, detail: "siteId required" };
      if (!state.pausedBusinesses.includes(siteId)) {
        state.pausedBusinesses.push(siteId);
      }
      break;
    case "resume_business":
      if (!siteId) return { ok: false, state, detail: "siteId required" };
      state.pausedBusinesses = state.pausedBusinesses.filter((s) => s !== siteId);
      break;
    case "prioritize_business":
      if (!siteId) return { ok: false, state, detail: "siteId required" };
      state.prioritizedBusinesses = [
        siteId,
        ...state.prioritizedBusinesses.filter((s) => s !== siteId),
      ].slice(0, 10);
      break;
    default:
      return { ok: false, state, detail: "unknown_command" };
  }

  state.updatedAt = at;
  state.updatedBy = actor;
  await saveOwnerControls(input.client, state);
  await audit(input.client, {
    at,
    command: input.command,
    target: siteId,
    detail: `Owner control ${input.command}${siteId ? ` → ${siteId}` : ""}`,
    actor,
  });

  return {
    ok: true,
    state,
    detail: `Applied ${input.command}${siteId ? ` for ${siteId}` : ""} — learning and queues retained`,
  };
}

export function isBusinessCommerciallyPaused(
  state: OwnerControlState,
  siteId: string,
): boolean {
  return state.portfolioPaused || state.pausedBusinesses.includes(siteId);
}

export function prioritizeBoostMs(
  state: OwnerControlState,
  siteId: string,
): number {
  const idx = state.prioritizedBusinesses.indexOf(siteId);
  if (idx < 0) return 0;
  // Higher priority → shorter wait between ticks (still gated by brain cooldowns).
  return Math.max(0, 30_000 - idx * 5_000);
}
