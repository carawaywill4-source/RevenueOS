/**
 * Server-side data helpers for the dashboard.
 *
 * All reads go through the same Supabase tables the operator writes
 * to. If Supabase is unset we surface friendly empty states rather
 * than crashing — dashboard is a solo tool and can degrade gracefully.
 */

import { getSupabase, supabaseConfigured } from "./supabase";

export type BusinessOverview = {
  siteId: string;
  purchases: number;
  revenueUsd: number;
  landingViews: number;
  actionsPastHour: number;
  claim: {
    owner: string | null;
    active: boolean;
    leaseUntil: string | null;
  } | null;
  topChannels: Array<{
    platform: string;
    revenuePerAction: number;
    status: string;
    confidence: number;
  }>;
  alerts: string[];
};

export type DraftItem = {
  id: string;
  siteId: string;
  platform: string;
  kind: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  payload: Record<string, unknown>;
  ownerNote: string | null;
};

export type ChannelViewer = {
  siteId: string;
  channels: Array<{
    id: string;
    platform: string;
    account: string;
    revenuePerAction: number;
    confidence: number;
    status: string;
    document: Record<string, unknown>;
  }>;
};

export type LeadItem = {
  siteId: string;
  createdAt: string;
  eventType: string;
  reach: string;
  detail: Record<string, unknown>;
};

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!supabaseConfigured()) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function fetchBusinessOverviews(
  businesses: Array<{ siteId: string; displayName: string; appUrl: string }>,
): Promise<Array<BusinessOverview & { displayName: string; appUrl: string }>> {
  const sb = supabaseConfigured() ? getSupabase() : null;
  const results: Array<BusinessOverview & { displayName: string; appUrl: string }> = [];
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();

  for (const b of businesses) {
    const alerts: string[] = [];
    let purchases = 0;
    let revenueUsd = 0;
    let landingViews = 0;
    let actionsPastHour = 0;
    let claim: BusinessOverview["claim"] = null;
    let topChannels: BusinessOverview["topChannels"] = [];

    if (sb) {
      const [purchaseRes, eventsRes, claimRes, channelsRes] = await Promise.all([
        safeQuery(
          async () => {
            const r = await sb
              .from("revenueos_purchases")
              .select("amount")
              .eq("site_id", b.siteId);
            return r.data ?? [];
          },
          [] as Array<{ amount: number }>,
        ),
        safeQuery(
          async () => {
            const r = await sb
              .from("revenueos_pursuit_events")
              .select("id,event_type,detail,created_at")
              .eq("site_id", b.siteId)
              .gte("created_at", oneHourAgo)
              .order("created_at", { ascending: false })
              .limit(500);
            return r.data ?? [];
          },
          [] as Array<{
            id: string;
            event_type: string;
            detail: Record<string, unknown>;
            created_at: string;
          }>,
        ),
        safeQuery(
          async () => {
            const r = await sb
              .from("revenueos_operator_claims")
              .select("owner,lease_until")
              .eq("site_id", b.siteId)
              .maybeSingle();
            return r.data ?? null;
          },
          null as { owner: string; lease_until: string } | null,
        ),
        safeQuery(
          async () => {
            const r = await sb
              .from("revenueos_channels")
              .select("document")
              .eq("site_id", b.siteId)
              .order("revenue_per_action", { ascending: false })
              .limit(4);
            return r.data ?? [];
          },
          [] as Array<{ document: Record<string, unknown> }>,
        ),
      ]);

      purchases = purchaseRes.length;
      revenueUsd = purchaseRes.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      for (const ev of eventsRes) {
        if (ev.event_type === "beacon") {
          if (ev.detail?.kind === "page_view") landingViews += 1;
        } else if (
          ev.event_type === "executed" ||
          ev.event_type === "enqueued"
        ) {
          actionsPastHour += 1;
        }
      }

      if (claimRes?.lease_until) {
        claim = {
          owner: claimRes.owner ?? null,
          active: Date.parse(claimRes.lease_until) > Date.now(),
          leaseUntil: claimRes.lease_until,
        };
      }

      topChannels = channelsRes
        .map((row) => row.document as Record<string, unknown>)
        .map((doc) => ({
          platform: String(doc.platform ?? "unknown"),
          revenuePerAction: Number(doc.revenuePerAction ?? 0),
          confidence: Number(doc.confidence ?? 0),
          status: String(doc.status ?? "active"),
        }));

      if (actionsPastHour === 0) alerts.push("no_actions_last_hour");
      if (purchases === 0 && landingViews > 100) alerts.push("traffic_no_purchases");
      if (claim && !claim.active) alerts.push("operator_claim_stale");
    }

    results.push({
      siteId: b.siteId,
      displayName: b.displayName,
      appUrl: b.appUrl,
      purchases,
      revenueUsd,
      landingViews,
      actionsPastHour,
      claim,
      topChannels,
      alerts,
    });
  }
  return results;
}

export async function fetchDrafts(): Promise<DraftItem[]> {
  const sb = supabaseConfigured() ? getSupabase() : null;
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("revenueos_owner_drafts")
      .select("id,site_id,platform,kind,payload,status,owner_note,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return [];
    return (data ?? []).map((row) => ({
      id: row.id,
      siteId: row.site_id,
      platform: row.platform,
      kind: row.kind,
      createdAt: row.created_at,
      status: row.status as DraftItem["status"],
      payload: (row.payload ?? {}) as Record<string, unknown>,
      ownerNote: row.owner_note,
    }));
  } catch {
    return [];
  }
}

export async function fetchChannels(siteId: string): Promise<ChannelViewer> {
  const sb = supabaseConfigured() ? getSupabase() : null;
  if (!sb) return { siteId, channels: [] };
  const { data, error } = await sb
    .from("revenueos_channels")
    .select(
      "id,platform,account,revenue_per_action,confidence,status,document",
    )
    .eq("site_id", siteId)
    .order("revenue_per_action", { ascending: false });
  if (error || !data) return { siteId, channels: [] };
  return {
    siteId,
    channels: data.map((row) => ({
      id: row.id,
      platform: row.platform,
      account: row.account,
      revenuePerAction: Number(row.revenue_per_action) || 0,
      confidence: Number(row.confidence) || 0,
      status: row.status,
      document: (row.document ?? {}) as Record<string, unknown>,
    })),
  };
}

export async function fetchLeads(siteId: string): Promise<LeadItem[]> {
  const sb = supabaseConfigured() ? getSupabase() : null;
  if (!sb) return [];
  const { data, error } = await sb
    .from("revenueos_pursuit_events")
    .select("site_id,event_type,detail,created_at")
    .eq("site_id", siteId)
    .in("event_type", ["buyer_discovered", "public_lead", "channel_lead"])
    .order("created_at", { ascending: false })
    .limit(80);
  if (error || !data) return [];
  return data.map((row) => ({
    siteId: row.site_id,
    createdAt: row.created_at,
    eventType: row.event_type,
    reach: String(
      (row.detail as Record<string, unknown> | null)?.reach ?? "unknown",
    ),
    detail: (row.detail ?? {}) as Record<string, unknown>,
  }));
}
