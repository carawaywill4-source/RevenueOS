/**
 * Operator claims — the coordination table between persistent operator and
 * per-app cron. When an operator claims a business, that app's cron reads
 * the claim on tick and no-ops. If the operator goes silent for >5min the
 * claim is stale and the app cron picks up again — falling back to the
 * serverless form without owner intervention.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimStatus = {
  siteId: string;
  owner: string;
  leaseUntil: string;
  claimedAt: string;
  active: boolean;
};

const TABLE = "revenueos_operator_claims";

export async function claimBusiness(
  client: SupabaseClient,
  input: {
    siteId: string;
    owner: string;
    leaseMs: number;
    now?: Date;
  },
): Promise<ClaimStatus | null> {
  const now = input.now ?? new Date();
  const leaseUntil = new Date(now.getTime() + input.leaseMs).toISOString();
  const { data: existing } = await client
    .from(TABLE)
    .select("owner,lease_until,claimed_at")
    .eq("site_id", input.siteId)
    .maybeSingle();

  if (
    existing &&
    existing.owner &&
    existing.owner !== input.owner &&
    existing.lease_until &&
    Date.parse(existing.lease_until) > now.getTime()
  ) {
    return null;
  }

  const { error } = await client.from(TABLE).upsert(
    {
      site_id: input.siteId,
      owner: input.owner,
      lease_until: leaseUntil,
      claimed_at: now.toISOString(),
    },
    { onConflict: "site_id" },
  );
  if (error) return null;
  return {
    siteId: input.siteId,
    owner: input.owner,
    leaseUntil,
    claimedAt: now.toISOString(),
    active: true,
  };
}

export async function releaseBusiness(
  client: SupabaseClient,
  input: { siteId: string; owner: string },
): Promise<void> {
  await client
    .from(TABLE)
    .update({ lease_until: new Date(0).toISOString() })
    .eq("site_id", input.siteId)
    .eq("owner", input.owner);
}

export async function listActiveClaims(
  client: SupabaseClient,
): Promise<ClaimStatus[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("site_id,owner,lease_until,claimed_at");
  if (error) return [];
  const now = Date.now();
  return (data ?? []).map((row) => ({
    siteId: row.site_id,
    owner: row.owner,
    leaseUntil: row.lease_until,
    claimedAt: row.claimed_at,
    active: row.lease_until ? Date.parse(row.lease_until) > now : false,
  }));
}

export async function isClaimedByOperator(
  client: SupabaseClient,
  siteId: string,
): Promise<boolean> {
  const { data } = await client
    .from(TABLE)
    .select("lease_until")
    .eq("site_id", siteId)
    .maybeSingle();
  if (!data?.lease_until) return false;
  return Date.parse(data.lease_until) > Date.now();
}
