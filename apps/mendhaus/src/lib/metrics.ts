import type { HourPulse } from "@tributeready/revenueos";
import { PRODUCTS } from "@/catalog/products";
import { MH_EVENTS } from "./events";
import { supabaseConfigured, getSupabaseAdmin } from "./supabase";

export type FunnelCounts = Partial<Record<string, number>>;

/** Count events by name without pulling every row — safe under high traffic. */
async function countEventsByName(sinceIso: string): Promise<FunnelCounts> {
  const sb = getSupabaseAdmin();
  const counts: FunnelCounts = {};
  await Promise.all(
    MH_EVENTS.map(async (name) => {
      const { count, error } = await sb
        .from("mh_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", name)
        .gte("created_at", sinceIso);
      if (!error && count != null) counts[name] = count;
    }),
  );
  return counts;
}

export type MoneyPlan = {
  revenueUsd: number;
  orders: number;
  aovUsd: number;
  cogsUsd: number;
  grossProfitUsd: number;
  refundsUsd: number;
  refundCount: number;
  netContributionUsd: number;
  visitors: number;
  conversionRate: number;
  profitPerVisitorUsd: number;
  topChannel: string | null;
  topPersona: string | null;
  topAngle: string | null;
  topProductId: string | null;
  topProductName: string | null;
  topLandingPage: string | null;
  winningExperimentId: string | null;
  explorationRate: number;
  learningConfidence: number;
};

export type WindowSnapshot = {
  days: number;
  events: FunnelCounts;
  orders: {
    byStatus: FunnelCounts;
    grossRevenueUsd: number;
    cogsUsd: number;
    feesUsd: number;
    shippingCostUsd: number;
    estimatedProfitUsd: number;
    realizedProfitUsd: number;
    refundsUsd: number;
  };
  attribution: {
    channels: Record<string, { orders: number; revenueUsd: number; profitUsd: number }>;
    personas: Record<string, { orders: number; revenueUsd: number; profitUsd: number }>;
    angles: Record<string, { orders: number; revenueUsd: number; profitUsd: number }>;
    landings: Record<string, { orders: number; revenueUsd: number; profitUsd: number }>;
    products: Record<string, { orders: number; revenueUsd: number; profitUsd: number }>;
  };
};

function emptySnapshot(days: number): WindowSnapshot {
  return {
    days,
    events: {},
    orders: {
      byStatus: {},
      grossRevenueUsd: 0,
      cogsUsd: 0,
      feesUsd: 0,
      shippingCostUsd: 0,
      estimatedProfitUsd: 0,
      realizedProfitUsd: 0,
      refundsUsd: 0,
    },
    attribution: {
      channels: {},
      personas: {},
      angles: {},
      landings: {},
      products: {},
    },
  };
}

function bump(
  map: Record<string, { orders: number; revenueUsd: number; profitUsd: number }>,
  key: string,
  revenue: number,
  profit: number,
) {
  const current = map[key] ?? { orders: 0, revenueUsd: 0, profitUsd: 0 };
  current.orders += 1;
  current.revenueUsd += revenue;
  current.profitUsd += profit;
  map[key] = current;
}

export async function getWindowSnapshot(days: number): Promise<WindowSnapshot> {
  if (!supabaseConfigured()) return emptySnapshot(days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const sb = getSupabaseAdmin();

  const [events, { data: orders }] = await Promise.all([
    countEventsByName(since),
    sb
      .from("mh_orders")
      .select(
        "status,gross_revenue_usd,cogs_usd,stripe_fee_usd,shipping_cost_usd,estimated_profit_usd,realized_profit_usd,attribution,items",
      )
      .gte("created_at", since),
  ]);

  const snapshot = emptySnapshot(days);
  snapshot.events = events;

  for (const row of orders ?? []) {
    const order = row as {
      status: string;
      gross_revenue_usd: number | string;
      cogs_usd: number | string;
      stripe_fee_usd: number | string;
      shipping_cost_usd: number | string;
      estimated_profit_usd: number | string;
      realized_profit_usd: number | string | null;
      attribution: Record<string, unknown> | null;
      items: Array<{ productId?: string }> | null;
    };
    snapshot.orders.byStatus[order.status] =
      (snapshot.orders.byStatus[order.status] ?? 0) + 1;
    const revenue = Number(order.gross_revenue_usd) || 0;
    const cogs = Number(order.cogs_usd) || 0;
    const fees = Number(order.stripe_fee_usd) || 0;
    const ship = Number(order.shipping_cost_usd) || 0;
    const est = Number(order.estimated_profit_usd) || 0;
    const realized =
      order.realized_profit_usd == null ? est : Number(order.realized_profit_usd) || 0;

    if (order.status === "refunded" || order.status === "cancelled") {
      snapshot.orders.refundsUsd += revenue;
    }
    if (["paid", "fulfilling", "shipped", "delivered"].includes(order.status)) {
      snapshot.orders.grossRevenueUsd += revenue;
      snapshot.orders.cogsUsd += cogs;
      snapshot.orders.feesUsd += fees;
      snapshot.orders.shippingCostUsd += ship;
      snapshot.orders.estimatedProfitUsd += est;
      snapshot.orders.realizedProfitUsd += realized;

      const attr = order.attribution ?? {};
      const channel = String(attr.channel ?? "direct");
      const persona = String(attr.persona ?? "unknown");
      const angle = `a${Number(attr.angleIndex ?? 0)}`;
      const landing = String(attr.landingPath ?? "/");
      bump(snapshot.attribution.channels, channel, revenue, realized);
      bump(snapshot.attribution.personas, persona, revenue, realized);
      bump(snapshot.attribution.angles, angle, revenue, realized);
      bump(snapshot.attribution.landings, landing, revenue, realized);
      const productId = order.items?.[0]?.productId;
      if (productId) {
        bump(snapshot.attribution.products, productId, revenue, realized);
      }
    }
  }

  return snapshot;
}

export async function getLastHourPulse(): Promise<HourPulse> {
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 60 * 1000);
  if (!supabaseConfigured()) {
    return {
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      revenueUsd: 0,
      purchases: 0,
      landingViews: 0,
      checkouts: 0,
      zeroHour: true,
    };
  }
  const sb = getSupabaseAdmin();
  const since = start.toISOString();
  const [eventCounts, { data: orders }] = await Promise.all([
    countEventsByName(since),
    sb
      .from("mh_orders")
      .select("status,gross_revenue_usd")
      .gte("paid_at", since)
      .in("status", ["paid", "fulfilling", "shipped", "delivered"]),
  ]);
  const purchases = (orders ?? []).length;
  const revenueUsd = (orders ?? []).reduce(
    (sum, row) => sum + (Number((row as { gross_revenue_usd: number }).gross_revenue_usd) || 0),
    0,
  );
  return {
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    revenueUsd: Number(revenueUsd.toFixed(2)),
    purchases,
    landingViews: eventCounts.landing_view ?? 0,
    checkouts: eventCounts.checkout_started ?? 0,
    zeroHour: revenueUsd <= 0,
  };
}

function topKey(
  map: Record<string, { orders: number; revenueUsd: number; profitUsd: number }>,
) {
  return (
    Object.entries(map).sort((a, b) => b[1].profitUsd - a[1].profitUsd)[0]?.[0] ??
    null
  );
}

export async function buildMoneyPlan(days = 7): Promise<MoneyPlan> {
  const snap = await getWindowSnapshot(days);
  const visitors = snap.events.landing_view ?? 0;
  const orders =
    (snap.orders.byStatus.paid ?? 0) +
    (snap.orders.byStatus.fulfilling ?? 0) +
    (snap.orders.byStatus.shipped ?? 0) +
    (snap.orders.byStatus.delivered ?? 0);
  const revenue = snap.orders.grossRevenueUsd;
  const aov = orders > 0 ? revenue / orders : 0;
  const refunds = snap.orders.refundsUsd;
  const grossProfit = snap.orders.realizedProfitUsd || snap.orders.estimatedProfitUsd;
  const net = grossProfit - refunds;
  const topProductId = topKey(snap.attribution.products);
  const topProduct = PRODUCTS.find((p) => p.id === topProductId);

  return {
    revenueUsd: Number(revenue.toFixed(2)),
    orders,
    aovUsd: Number(aov.toFixed(2)),
    cogsUsd: Number(snap.orders.cogsUsd.toFixed(2)),
    grossProfitUsd: Number(grossProfit.toFixed(2)),
    refundsUsd: Number(refunds.toFixed(2)),
    refundCount: snap.orders.byStatus.refunded ?? 0,
    netContributionUsd: Number(net.toFixed(2)),
    visitors,
    conversionRate: visitors > 0 ? Number((orders / visitors).toFixed(4)) : 0,
    profitPerVisitorUsd: visitors > 0 ? Number((net / visitors).toFixed(4)) : 0,
    topChannel: topKey(snap.attribution.channels),
    topPersona: topKey(snap.attribution.personas),
    topAngle: topKey(snap.attribution.angles),
    topProductId,
    topProductName: topProduct?.name ?? null,
    topLandingPage: topKey(snap.attribution.landings),
    winningExperimentId: null,
    explorationRate: 0.35,
    learningConfidence: visitors < 50 ? 0.15 : visitors < 200 ? 0.35 : 0.55,
  };
}

export async function listJournal(limit = 40) {
  if (!supabaseConfigured()) return [];
  const { data } = await getSupabaseAdmin()
    .from("mh_journal")
    .select("id,summary,detail,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
