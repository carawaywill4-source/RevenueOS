/**
 * Owner-facing sanitized API payloads for the SwiftUI app.
 * No job IDs, raw JSON docs, or secrets — business language only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAICapabilityStatus } from "@revenueos/core";
import type { BusinessRuntimeStatus } from "./scheduler.js";
import { PORTFOLIO } from "../portfolio.js";
import type { OwnerControlState } from "./owner-controls.js";
import { loadArchitectState } from "./portfolio-evolution.js";

/** Classify pursuit actions for owner reporting — not all work is commercial. */
export function classifyActionQuality(actionType: string):
  | "commercial"
  | "measurement"
  | "learning"
  | "infrastructure" {
  if (
    /indexnow_submit|ping_search|sitemap_ping|scorecard|heartbeat|claim|health/i.test(
      actionType,
    )
  ) {
    return "infrastructure";
  }
  if (/market_research|pattern|lesson|scorecard_snapshot/i.test(actionType)) {
    return /scorecard/.test(actionType) ? "infrastructure" : "learning";
  }
  if (/beacon|analytics|metric|measure/i.test(actionType)) return "measurement";
  if (
    /publish|discovery|directory|gumroad|youtube|distribute|outreach|gbp|nextdoor|bing|feature_product|checkout|stripe/i.test(
      actionType,
    )
  ) {
    return "commercial";
  }
  return "infrastructure";
}

function plainStatus(
  b: BusinessRuntimeStatus,
  controls?: OwnerControlState,
): string {
  if (controls?.portfolioPaused || controls?.pausedBusinesses?.includes(b.siteId)) {
    return "Paused by owner";
  }
  if (b.commerciallyPaused) return "Paused by owner";
  if (b.lastError && /DEGRADED|claim_denied/i.test(b.lastError)) {
    return "Needs attention";
  }
  if (b.lastOk === false) return "Repairing";
  if ((b.lastExecuted ?? 0) > 0) return "Pursuing customers";
  if ((b.lastEnqueued ?? 0) > 0) return "Planning next moves";
  if (b.claimedUntil && Date.parse(b.claimedUntil) > Date.now()) {
    return "Operating";
  }
  return "Standing by";
}

export async function buildOwnerDashboard(input: {
  client: SupabaseClient;
  businesses: BusinessRuntimeStatus[];
  uptimeSec: number;
  startedAt: string;
  ownerControls?: OwnerControlState;
}): Promise<Record<string, unknown>> {
  const openai = getOpenAICapabilityStatus();
  const controls = input.ownerControls;
  const cards = input.businesses.map((b) => {
    const manifest = PORTFOLIO.find((p) => p.siteId === b.siteId);
    return {
      id: b.siteId,
      name: manifest?.displayName ?? b.displayName,
      revenueTodayLabel: "$—",
      status: plainStatus(b, controls),
      currentlyDoing:
        controls?.portfolioPaused || controls?.pausedBusinesses?.includes(b.siteId)
          ? "Paused — claim held, queues retained"
          : (b.lastExecuted ?? 0) > 0
            ? "Executing commercial work"
            : (b.lastEnqueued ?? 0) > 0
              ? "Selecting next commercial actions"
              : "Observing the market",
    };
  });

  const operatingCount = cards.filter(
    (c) => c.status !== "Paused by owner" && c.status !== "Needs attention",
  ).length;
  const pausedCount = cards.filter((c) => c.status === "Paused by owner").length;

  const needsYou: Array<{ title: string; detail: string }> = [];
  if (openai.status !== "ok") {
    needsYou.push({
      title: "OpenAI",
      detail:
        openai.code === "no_credits"
          ? "Reasoning capability degraded — API returned no credits (429)."
          : openai.reason ?? openai.note,
    });
  }
  needsYou.push({
    title: "Mendhaus",
    detail: "Fulfillment unavailable — supplier path not ready for paid orders.",
  });

  const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const siteIds = input.businesses.map((b) => b.siteId);
  let activity: Array<Record<string, unknown>> = [];
  if (siteIds.length) {
    const { data } = await input.client
      .from("revenueos_experiments")
      .select("document,updated_at,site_id")
      .eq("category", "__ros_pursuit_event__")
      .in("site_id", siteIds)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(40);
    activity = (data ?? [])
      .map((row) => {
        const ev = (row.document ?? {}) as {
          eventType?: string;
          detail?: { actionType?: string; detail?: string; ok?: boolean };
          createdAt?: string;
        };
        if (ev.eventType !== "executed" || ev.detail?.ok !== true) return null;
        const action = String(ev.detail?.actionType ?? "action");
        if (classifyActionQuality(action) !== "commercial") return null;
        const name =
          PORTFOLIO.find((p) => p.siteId === row.site_id)?.displayName ??
          row.site_id;
        const summary = String(ev.detail?.detail ?? action).slice(0, 160);
        return {
          at: ev.createdAt ?? row.updated_at,
          business: name,
          summary: ownerLanguage(action, summary),
          quality: "commercial",
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
  }

  let evolution: Record<string, unknown> | null = null;
  try {
    const arch = await loadArchitectState(input.client);
    evolution = {
      active: input.businesses.length,
      maxActive: arch.safety.maxActiveBusinesses,
      incubating: arch.opportunities.filter((o) => o.lifecycle === "incubating")
        .length,
      researching: arch.opportunities.filter((o) =>
        ["idea", "research", "validated_hypothesis"].includes(o.lifecycle),
      ).length,
      retired: arch.retirementDecisions.length,
      autonomousLaunches: arch.launches.length,
      stopCreatingNewBusinesses: arch.safety.stopCreatingNewBusinesses,
    };
  } catch {
    evolution = null;
  }

  return {
    ok: true,
    brand: "RevenueOS",
    health: {
      label: controls?.portfolioPaused ? "Paused" : "Operating",
      attention: openai.status !== "ok" || Boolean(controls?.portfolioPaused),
      uptimeSec: input.uptimeSec,
      startedAt: input.startedAt,
    },
    portfolioSummary: {
      operating: operatingCount,
      paused: pausedCount,
      ownerBlocked: 1, // Mendhaus fulfillment
      claimed: input.businesses.length,
      maxActive: 50,
      ...(evolution ?? {}),
    },
    portfolioEvolution: evolution,
    capabilities: {
      commercialExecution: true,
      memory: true,
      learning: true,
      portfolio: true,
      openaiReasoning: openai.status === "ok" ? "ok" : "degraded",
      openaiNote: openai.note,
    },
    today: {
      revenueLabel: "$—",
      stripeAvailableLabel: null,
      stripePendingLabel: null,
      purchases: null,
      visitors: null,
      note: "Stripe figures load from /money — not invented here",
    },
    businesses: cards,
    activity,
    needsYou,
    ownerControls: controls ?? null,
  };
}

function ownerLanguage(actionType: string, detail: string): string {
  if (/publish|discovery_attack/i.test(actionType)) {
    if (/Published intent door/i.test(detail)) {
      return detail.replace(/^Published intent door/, "Published buyer-intent page");
    }
    if (/programmatic door/i.test(detail)) {
      return "Published a new buyer-discovery page";
    }
    return "Published a new acquisition asset";
  }
  if (/market_research/i.test(actionType)) return "Researched buyer demand";
  if (/directory/i.test(actionType)) return "Submitted to a public directory";
  if (/youtube/i.test(actionType)) return "Scouted YouTube buyer-intent conversations";
  if (/gumroad/i.test(actionType)) return "Synced Gumroad product listing";
  if (/gbp|nextdoor|bing/i.test(actionType)) return "Prepared a free listing surface";
  return detail.slice(0, 140);
}
