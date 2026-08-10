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

/** Native Postgres dashboard — no Supabase client. */
export async function buildOwnerDashboardNative(input: {
  businesses: BusinessRuntimeStatus[];
  uptimeSec: number;
  startedAt: string;
  ownerControls?: OwnerControlState;
  recentEvents?: Array<{
    at: string;
    siteId: string;
    eventType?: string;
    actionType?: string;
    detail?: string;
    ok?: boolean;
  }>;
  dataProvider?: string;
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
  const operationalFromTicks = input.businesses
    .filter((b) => b.lastTickAt)
    .sort(
      (a, b) =>
        Date.parse(b.lastTickAt ?? "0") - Date.parse(a.lastTickAt ?? "0"),
    )
    .slice(0, 25)
    .map((b) => {
      const name =
        PORTFOLIO.find((p) => p.siteId === b.siteId)?.displayName ??
        b.displayName;
      const executed = b.lastExecuted ?? 0;
      const enqueued = b.lastEnqueued ?? 0;
      return {
        at: b.lastTickAt,
        business: name,
        summary:
          executed > 0
            ? `Executed ${executed} commercial action${executed === 1 ? "" : "s"}`
            : enqueued > 0
              ? `Planned ${enqueued} next move${enqueued === 1 ? "" : "s"}`
              : b.lastOk === false
                ? `Repairing — ${b.lastError ?? "tick error"}`
                : "Operating cycle completed",
        quality: executed > 0 ? "commercial" : "operational",
      };
    });
  let activity: Array<Record<string, unknown>> = [...operationalFromTicks];
  for (const ev of input.recentEvents ?? []) {
    if (ev.eventType === "executed" && ev.ok === true) {
      const name =
        PORTFOLIO.find((p) => p.siteId === ev.siteId)?.displayName ?? ev.siteId;
      activity.push({
        at: ev.at,
        business: name,
        summary: ownerLanguage(
          String(ev.actionType ?? "action"),
          String(ev.detail ?? ev.actionType ?? "action").slice(0, 160),
        ),
        quality: classifyActionQuality(String(ev.actionType ?? "action")),
      });
    }
  }
  activity.sort(
    (a, b) =>
      Date.parse(String(b.at ?? "0")) - Date.parse(String(a.at ?? "0")),
  );
  activity = activity.slice(0, 40);
  return {
    ok: true,
    brand: "RevenueOS",
    authority: "mac/native",
    dataProvider: input.dataProvider ?? "postgres",
    health: {
      label: controls?.portfolioPaused ? "Paused" : "Operating",
      attention: openai.status !== "ok" || Boolean(controls?.portfolioPaused),
      uptimeSec: input.uptimeSec,
      startedAt: input.startedAt,
    },
    portfolioSummary: {
      operating: operatingCount,
      paused: pausedCount,
      ownerBlocked: 0,
      claimed: input.businesses.length,
      maxActive: 50,
    },
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
      note: "Stripe figures load from /money — not invented here",
    },
    businesses: cards,
    activity,
    needsYou:
      openai.status !== "ok"
        ? [
            {
              title: "OpenAI",
              detail: openai.reason ?? openai.note,
            },
          ]
        : [],
    ownerControls: controls ?? null,
  };
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

  /** In-memory tick feed — always available even when Supabase is slow. */
  const operationalFromTicks = input.businesses
    .filter((b) => b.lastTickAt)
    .sort(
      (a, b) =>
        Date.parse(b.lastTickAt ?? "0") - Date.parse(a.lastTickAt ?? "0"),
    )
    .slice(0, 25)
    .map((b) => {
      const name =
        PORTFOLIO.find((p) => p.siteId === b.siteId)?.displayName ??
        b.displayName;
      const executed = b.lastExecuted ?? 0;
      const enqueued = b.lastEnqueued ?? 0;
      const summary =
        executed > 0
          ? `Executed ${executed} commercial action${executed === 1 ? "" : "s"}`
          : enqueued > 0
            ? `Planned ${enqueued} next move${enqueued === 1 ? "" : "s"}`
            : b.lastOk === false
              ? `Repairing — ${b.lastError ?? "tick error"}`
              : "Operating cycle completed";
      return {
        at: b.lastTickAt,
        business: name,
        summary,
        quality: executed > 0 ? "commercial" : "operational",
      };
    });

  let activity: Array<Record<string, unknown>> = [...operationalFromTicks];

  if (siteIds.length) {
    try {
      const dbActivity = await Promise.race([
        input.client
          .from("revenueos_experiments")
          .select("document,updated_at,site_id")
          .eq("category", "__ros_pursuit_event__")
          .in("site_id", siteIds.slice(0, 12))
          .gte("updated_at", since)
          .order("updated_at", { ascending: false })
          .limit(40)
          .then(({ data }) =>
            (data ?? [])
              .map((row) => {
                const ev = (row.document ?? {}) as {
                  eventType?: string;
                  detail?: { actionType?: string; detail?: string; ok?: boolean };
                  createdAt?: string;
                };
                if (ev.eventType === "executed" && ev.detail?.ok === true) {
                  const action = String(ev.detail?.actionType ?? "action");
                  const name =
                    PORTFOLIO.find((p) => p.siteId === row.site_id)?.displayName ??
                    row.site_id;
                  const summary = String(ev.detail?.detail ?? action).slice(0, 160);
                  return {
                    at: ev.createdAt ?? row.updated_at,
                    business: name,
                    summary: ownerLanguage(action, summary),
                    quality: classifyActionQuality(action),
                  };
                }
                if (ev.eventType === "enqueued" || ev.eventType === "claimed") {
                  const name =
                    PORTFOLIO.find((p) => p.siteId === row.site_id)?.displayName ??
                    row.site_id;
                  return {
                    at: ev.createdAt ?? row.updated_at,
                    business: name,
                    summary:
                      ev.eventType === "enqueued"
                        ? "Queued pursuit work"
                        : "Claimed pursuit job",
                    quality: "operational",
                  };
                }
                return null;
              })
              .filter(Boolean) as Array<Record<string, unknown>>,
          ),
        new Promise<Array<Record<string, unknown>>>((resolve) =>
          setTimeout(() => resolve([]), 4_000),
        ),
      ]);
      const seen = new Set(
        activity.map((a) => `${a.at}|${a.business}|${a.summary}`),
      );
      for (const row of dbActivity) {
        const key = `${row.at}|${row.business}|${row.summary}`;
        if (!seen.has(key)) {
          activity.push(row);
          seen.add(key);
        }
      }
      activity.sort(
        (a, b) =>
          Date.parse(String(b.at ?? "0")) - Date.parse(String(a.at ?? "0")),
      );
      activity = activity.slice(0, 40);
    } catch {
      /* operationalFromTicks already populated */
    }
  }

  let evolution: Record<string, unknown> | null = null;
  try {
    const arch = await Promise.race([
      loadArchitectState(input.client),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
    ]);
    if (arch) {
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
    }
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
