/**
 * Owner command/chat — queries live Core + durable memory.
 * Primary brain: xAI Grok (OWNER_DIALOG). OpenAI is fallback only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOpenAICapabilityStatus,
  handleOwnerMessage,
  xaiHealth,
  type OwnerDialogState,
} from "@revenueos/core";
import type { BusinessRuntimeStatus } from "./scheduler.js";
import { PORTFOLIO } from "../portfolio.js";

function factualAnswer(
  message: string,
  businesses: BusinessRuntimeStatus[],
  activity: Array<{ business: string; summary: string; at: string }>,
): string | null {
  const msg = message.toLowerCase();
  if (/what are you doing|right now|currently doing/.test(msg)) {
    return null;
  }
  if (/learned today|what have you learned/.test(msg)) {
    if (!activity.length) {
      return "No commercial learning events recorded in the recent window yet.";
    }
    return `Recent commercial work I can cite:\n${activity
      .slice(0, 8)
      .map((a) => `• ${a.business}: ${a.summary}`)
      .join("\n")}`;
  }
  if (/closest to a sale|closest to sale|nearest.*sale/.test(msg)) {
    const ranked = [...businesses].sort(
      (a, b) => (b.lastExecuted ?? 0) - (a.lastExecuted ?? 0),
    );
    const top = ranked[0];
    if (!top) return "No operating businesses to compare.";
    const name =
      PORTFOLIO.find((p) => p.siteId === top.siteId)?.displayName ??
      top.displayName;
    return `${name} is getting the most recent commercial execution attention among claimed businesses. First stranger sale is still the milestone — I won't invent purchase proximity.`;
  }
  if (/why hasn't (\w+)/.test(msg) || /hasn't .* sold/.test(msg)) {
    const m = msg.match(/why hasn't ([a-z0-9\-]+)/);
    const needle = m?.[1];
    const hit = businesses.find(
      (b) =>
        b.siteId.includes(needle ?? "") ||
        b.displayName.toLowerCase().includes(needle ?? ""),
    );
    const name = hit
      ? (PORTFOLIO.find((p) => p.siteId === hit.siteId)?.displayName ??
        hit.displayName)
      : needle ?? "that business";
    return `${name} has not recorded a first stranger sale in Core's durable memory yet. Pursuit continues via publish/discovery limbs; OpenAI generative outreach may be deferred while reasoning is degraded. I won't invent a conversion diagnosis without purchase telemetry.`;
  }
  if (/caused today's revenue|today's revenue/.test(msg)) {
    return "I won't invent revenue attribution. Stripe successful payments (when available via Core /money) are the financial truth; portfolio purchase ledgers in Supabase are commercial truth.";
  }
  return null;
}

export async function ownerChat(input: {
  message: string;
  client: SupabaseClient;
  businesses: BusinessRuntimeStatus[];
  uptimeSec: number;
}): Promise<Record<string, unknown>> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const siteIds = input.businesses.map((b) => b.siteId);
  let activity: Array<{ business: string; summary: string; at: string }> = [];
  if (siteIds.length) {
    const { data } = await input.client
      .from("revenueos_experiments")
      .select("document,updated_at,site_id")
      .eq("category", "__ros_pursuit_event__")
      .in("site_id", siteIds)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(30);
    activity = (data ?? [])
      .map((row) => {
        const ev = (row.document ?? {}) as {
          eventType?: string;
          detail?: { actionType?: string; detail?: string; ok?: boolean };
          createdAt?: string;
        };
        if (ev.eventType !== "executed" || ev.detail?.ok !== true) return null;
        const name =
          PORTFOLIO.find((p) => p.siteId === row.site_id)?.displayName ??
          row.site_id;
        return {
          business: name,
          summary: String(ev.detail?.detail ?? ev.detail?.actionType ?? "").slice(
            0,
            140,
          ),
          at: String(ev.createdAt ?? row.updated_at),
        };
      })
      .filter(Boolean) as Array<{
      business: string;
      summary: string;
      at: string;
    }>;
  }

  const state: OwnerDialogState = {
    hoursSinceStart: Math.round(input.uptimeSec / 3600),
    activeBusinesses: input.businesses.map((b) => {
      const m = PORTFOLIO.find((p) => p.siteId === b.siteId);
      return {
        siteId: b.siteId,
        displayName: m?.displayName ?? b.displayName,
        revenueUsd: 0,
        firstCustomerMode: true,
        paused: false,
      };
    }),
  };

  const factual = factualAnswer(input.message, input.businesses, activity);
  const dialog = await handleOwnerMessage({
    message: input.message,
    state,
    preferProvider: "auto",
  });

  let answer = dialog.answer;
  let source = dialog.source;
  const xai = xaiHealth();
  const openai = getOpenAICapabilityStatus();

  // If Grok answered, keep it. Only overlay factual overrides for pure
  // status queries when the model returned deterministic fallback.
  if (source === "deterministic" && factual) {
    answer = factual;
  } else if (source === "deterministic" && openai.status !== "ok" && xai.status !== "AVAILABLE") {
    const banner =
      xai.status === "FAILED"
        ? `Grok unavailable (${"lastError" in xai ? xai.lastError : "failed"}). Answering from Core state only.\n\n`
        : xai.status === "DISABLED"
          ? "Grok not configured. Answering from Core state only.\n\n"
          : "AI reasoning degraded. Answering from Core state only.\n\n";
    if (!answer.includes("offline fallback") && !answer.includes("Grok unavailable")) {
      answer = banner + answer;
    }
  }

  return {
    ok: true,
    answer,
    proposedChanges: dialog.proposedChanges,
    source,
    model: dialog.model ?? null,
    capabilities: {
      xai:
        xai.status === "AVAILABLE"
          ? { status: "ok", model: xai.model }
          : { status: xai.status.toLowerCase(), detail: xai },
      openaiReasoning: openai.status === "ok" ? "ok" : "degraded",
      openaiNote: openai.note,
      primaryBrain: "xai_grok",
    },
    at: new Date().toISOString(),
  };
}

export async function buildBusinessDetail(input: {
  client: SupabaseClient;
  siteId: string;
  runtime?: BusinessRuntimeStatus;
}): Promise<Record<string, unknown>> {
  const manifest = PORTFOLIO.find((p) => p.siteId === input.siteId);
  if (!manifest) return { ok: false, reason: "unknown_business" };
  const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const { data: events } = await input.client
    .from("revenueos_experiments")
    .select("document,updated_at")
    .eq("site_id", input.siteId)
    .eq("category", "__ros_pursuit_event__")
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(25);

  const recentActions = (events ?? [])
    .map((row) => {
      const ev = (row.document ?? {}) as {
        eventType?: string;
        detail?: { actionType?: string; detail?: string; ok?: boolean };
        createdAt?: string;
      };
      if (ev.eventType !== "executed") return null;
      return {
        at: ev.createdAt ?? row.updated_at,
        summary: String(ev.detail?.detail ?? ev.detail?.actionType ?? "").slice(
          0,
          160,
        ),
        ok: ev.detail?.ok === true,
      };
    })
    .filter(Boolean);

  const { data: lessons } = await input.client
    .from("revenueos_experiments")
    .select("document,updated_at")
    .eq("site_id", input.siteId)
    .ilike("category", "%lesson%")
    .order("updated_at", { ascending: false })
    .limit(3);

  const latestLearning =
    lessons?.[0] && typeof lessons[0].document === "object"
      ? String(
          (lessons[0].document as { summary?: string; lesson?: string })
            .summary ??
            (lessons[0].document as { lesson?: string }).lesson ??
            "Recent learning recorded",
        ).slice(0, 200)
      : null;

  const rt = input.runtime;
  return {
    ok: true,
    name: manifest.displayName,
    id: manifest.siteId,
    revenueTodayLabel: "$—",
    purchases: null,
    visitors: null,
    checkoutStarts: null,
    note: "Purchase/visitor figures come from storefront ledgers when available — not invented",
    status:
      rt?.lastOk === false
        ? "Repairing"
        : (rt?.lastExecuted ?? 0) > 0
          ? "Pursuing customers"
          : "Operating",
    currentlyDoing:
      (rt?.lastExecuted ?? 0) > 0
        ? "Executing commercial work"
        : (rt?.lastEnqueued ?? 0) > 0
          ? "Selecting next commercial actions"
          : "Observing market and cooldowns",
    currentStrategy: manifest.brandVoice
      ? `Brand stance: ${manifest.brandVoice}`
      : "Permissionless acquisition",
    latestLearning,
    recentActions,
    revenueHistory: [],
    needsYou: [],
  };
}
