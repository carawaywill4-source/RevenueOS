import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { checkoutAllowed, ownerGates } from "@/lib/readiness";
import { purchaseStats } from "@/lib/purchases";
import { createAdapter } from "@/revenueos/adapter";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret =
    process.env.PORTFOLIO_PULSE_TOKEN || process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
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
  const events = store.listPursuitEvents
    ? await store.listPursuitEvents(adapter.id, { since, limit: 40 })
    : [];
  const executed = events.filter((e) =>
    ["executed", "advanced", "enqueued"].includes(e.eventType),
  ).length;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${BRAND.siteId}.vercel.app`;

  return NextResponse.json({
    siteId: BRAND.siteId,
    displayName: BRAND.displayName,
    url: appUrl,
    commerciallyLive: live,
    checkoutOpen: live,
    purchases: stats.purchases,
    revenueUsd: stats.revenueUsd,
    firstCustomerMode: stats.purchases <= 0,
    firstCustomerStage: "buyer_exposure",
    actionsCompleted: executed,
    exposureNotes: BRAND.discoveryDoors
      .slice(0, 2)
      .map((d) => `${appUrl.replace(/\/$/, "")}/topics/${d.slug}`),
    blockers: gates.filter((g) => !g.ok).map((g) => `${g.label}: ${g.detail}`),
  });
}
