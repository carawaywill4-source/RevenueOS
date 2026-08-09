import { NextResponse } from "next/server";
import {
  commercialActionTypesFromEvents,
  evaluateFirstCustomerMode,
} from "@revenueos/core";
import { resolveAppUrl } from "@revenueos/storefront-kit";
import { BRAND } from "@/lib/brand";
import { checkoutAllowed, ownerGates } from "@/lib/readiness";
import { purchaseStats } from "@/lib/purchases";
import { createAdapter } from "@/revenueos/adapter";
import { resolveDurableLedgerMode } from "@/revenueos/durable-store";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const candidates = [
    process.env.PORTFOLIO_PULSE_TOKEN,
    process.env.PORTFOLIO_CRON_SECRET,
    process.env.CRON_SECRET,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
  if (candidates.length === 0) return false;
  const header = request.headers.get("authorization") ?? "";
  return candidates.some((s) => header === `Bearer ${s}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await purchaseStats();
  const gates = ownerGates();
  const live = checkoutAllowed();
  const adapter = createAdapter();
  const store = adapter.getExperimentStore();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const ledgerMode = await resolveDurableLedgerMode();
  const events = store.listPursuitEvents
    ? await store.listPursuitEvents(adapter.id, { since, limit: 80 })
    : [];
  const executedEvents = events.filter(
    (e) => e.eventType === "executed" && e.detail?.ok === true,
  );
  const actionsCompleted = executedEvents.length;
  const actionTypes = commercialActionTypesFromEvents(events);

  const observation = await adapter.observe();
  const fcm = evaluateFirstCustomerMode(observation);

  const appUrl = resolveAppUrl({
    siteId: BRAND.siteId,
    envUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  const cycleStatus =
    ledgerMode === "ephemeral"
      ? ("failed" as const)
      : fcm.active && actionsCompleted <= 0
        ? ("failed" as const)
        : ("ok" as const);

  return NextResponse.json({
    siteId: BRAND.siteId,
    displayName: BRAND.displayName,
    url: appUrl,
    commerciallyLive: live,
    checkoutOpen: live,
    purchases: stats.purchases,
    revenueUsd: stats.revenueUsd,
    firstCustomerMode: fcm.active,
    firstCustomerStage: fcm.stage,
    actionsCompleted,
    durableLedger: ledgerMode,
    cycleStatus,
    thisHour: {
      actionsExecuted: actionsCompleted,
      actionTypes,
      checkouts: observation.funnel.checkouts,
      landingViews: observation.funnel.landingViews,
    },
    exposureNotes: BRAND.discoveryDoors
      .slice(0, 2)
      .map((d) => `${appUrl.replace(/\/$/, "")}/topics/${d.slug}`),
    blockers: [
      ...gates.filter((g) => !g.ok).map((g) => `${g.label}: ${g.detail}`),
      ...(ledgerMode === "ephemeral"
        ? ["durable_ledger_ephemeral: pursuit events not visible across instances"]
        : []),
    ],
  });
}
