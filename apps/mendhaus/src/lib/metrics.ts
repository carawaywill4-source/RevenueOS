import type { DiscoveryDoorMetrics, HourPulse } from "@revenueos/core";
import { PRODUCTS } from "@/catalog/products";
import { MH_EVENTS } from "./events";
import { readSearchConsoleDoorMetrics } from "./search-console";
import { supabaseConfigured, getSupabaseAdmin } from "./supabase";

export type FunnelCounts = Partial<Record<string, number>>;

/** Count events by name without pulling every row — safe under high traffic. */
async function countEventsByName(sinceIso: string): Promise<FunnelCounts> {
  const sb = getSupabaseAdmin();
  const counts: FunnelCounts = {};
  const results = await Promise.all(
    MH_EVENTS.map(async (name) => {
      const { count, error } = await sb
        .from("mh_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", name)
        .gte("created_at", sinceIso);
      return { name, count, error };
    }),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw new Error(`Could not measure ${failed.name}: ${failed.error.message}`);
  }
  for (const result of results) {
    if (result.count != null) counts[result.name] = result.count;
  }
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

  const [events, { data: orders, error: ordersError }] = await Promise.all([
    countEventsByName(since),
    sb
      .from("mh_orders")
      .select(
        "status,gross_revenue_usd,cogs_usd,stripe_fee_usd,shipping_cost_usd,estimated_profit_usd,realized_profit_usd,attribution,items",
      )
      .gte("created_at", since),
  ]);
  if (ordersError) throw new Error(`Could not measure orders: ${ordersError.message}`);

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
  const [eventCounts, { data: orders, error: ordersError }] = await Promise.all([
    countEventsByName(since),
    sb
      .from("mh_orders")
      .select("status,gross_revenue_usd")
      .gte("paid_at", since)
      .in("status", ["paid", "fulfilling", "shipped", "delivered"]),
  ]);
  if (ordersError) throw new Error(`Could not measure hourly orders: ${ordersError.message}`);
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
  const grossProfit =
    snap.orders.realizedProfitUsd !== 0
      ? snap.orders.realizedProfitUsd
      : snap.orders.estimatedProfitUsd;
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

/** On-site proxy metrics for one discovery door (topic slug). */
export async function measureDiscoveryDoorMetrics(input: {
  slug: string;
  productIds: string[];
  publishedAt: string;
}): Promise<DiscoveryDoorMetrics> {
  if (!supabaseConfigured()) {
    return {
      submitted: true,
      topicViews: 0,
      productViews: 0,
      addToCarts: 0,
      checkouts: 0,
      purchases: 0,
      revenueUsd: 0,
      indexed: null,
      impressions: null,
      clicks: null,
    };
  }
  const sb = getSupabaseAdmin();
  const since = input.publishedAt;
  const path = `/topics/${input.slug}`;

  const [landing, pageViews, productViews, carts] = await Promise.all([
    sb
      .from("mh_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "landing_view")
      .gte("created_at", since)
      .contains("metadata", { topic_slug: input.slug }),
    sb
      .from("mh_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "page_view")
      .gte("created_at", since)
      .contains("metadata", { path }),
    input.productIds.length
      ? sb
          .from("mh_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", "product_view")
          .gte("created_at", since)
          .in("product_id", input.productIds)
      : Promise.resolve({ count: 0, error: null }),
    input.productIds.length
      ? sb
          .from("mh_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", "add_to_cart")
          .gte("created_at", since)
          .in("product_id", input.productIds)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  let purchases = 0;
  let revenueUsd = 0;
  let checkouts = 0;
  if (input.productIds.length) {
    const { data: orders } = await sb
      .from("mh_orders")
      .select("items,gross_revenue_usd,status")
      .gte("created_at", since)
      .in("status", ["paid", "fulfilling", "shipped", "delivered"]);
    for (const order of orders ?? []) {
      const items = (order.items as Array<{ productId?: string }>) ?? [];
      if (!items.some((item) => item.productId && input.productIds.includes(item.productId))) {
        continue;
      }
      purchases += 1;
      revenueUsd += Number(order.gross_revenue_usd ?? 0);
    }
    // Prefer product-scoped checkouts; fall back to topic_slug. Never use
    // site-wide checkout_started — that leaks credit across doors.
    const [byProduct, byTopic] = await Promise.all([
      sb
        .from("mh_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "checkout_started")
        .gte("created_at", since)
        .in("product_id", input.productIds),
      sb
        .from("mh_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "checkout_started")
        .gte("created_at", since)
        .contains("metadata", { topic_slug: input.slug }),
    ]);
    checkouts = Math.max(byProduct.count ?? 0, byTopic.count ?? 0);
  }

  const topicViews = Math.max(landing.count ?? 0, pageViews.count ?? 0);
  const serp = await readSearchConsoleDoorMetrics(
    `https://mendhaus.shop/topics/${input.slug}`,
  );
  return {
    submitted: true,
    topicViews,
    productViews: productViews.count ?? 0,
    addToCarts: carts.count ?? 0,
    checkouts,
    purchases,
    revenueUsd: Number(revenueUsd.toFixed(2)),
    indexed: serp.indexed,
    impressions: serp.impressions,
    clicks: serp.clicks,
  };
}
