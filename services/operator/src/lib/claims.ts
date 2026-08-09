/**
 * Operator claims — coordination between persistent operator and per-app cron.
 *
 * Prefers native `revenueos_operator_claims`. When that table is missing
 * (migration not applied yet), falls back to a durable document row in
 * `revenueos_experiments` — same project, same service role, no second DB.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OPERATOR_CLAIM_CATEGORY,
  operatorClaimDocId,
} from "@revenueos/core";

export type ClaimStatus = {
  siteId: string;
  owner: string;
  leaseUntil: string;
  claimedAt: string;
  active: boolean;
  storage: "native" | "document";
};

const TABLE = "revenueos_operator_claims";

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table|does not exist/i.test(msg)
  );
}

async function claimNative(
  client: SupabaseClient,
  input: {
    siteId: string;
    owner: string;
    leaseMs: number;
    now: Date;
  },
): Promise<ClaimStatus | null | "missing_table"> {
  const leaseUntil = new Date(input.now.getTime() + input.leaseMs).toISOString();
  const { data: existing, error: readErr } = await client
    .from(TABLE)
    .select("owner,lease_until,claimed_at")
    .eq("site_id", input.siteId)
    .maybeSingle();
  if (isMissingTableError(readErr)) return "missing_table";

  if (
    existing &&
    existing.owner &&
    existing.owner !== input.owner &&
    existing.lease_until &&
    Date.parse(existing.lease_until) > input.now.getTime()
  ) {
    return null;
  }

  const claimedAt = input.now.toISOString();
  const { error } = await client.from(TABLE).upsert(
    {
      site_id: input.siteId,
      owner: input.owner,
      lease_until: leaseUntil,
      claimed_at: claimedAt,
    },
    { onConflict: "site_id" },
  );
  if (isMissingTableError(error)) return "missing_table";
  if (error) return null;
  return {
    siteId: input.siteId,
    owner: input.owner,
    leaseUntil,
    claimedAt,
    active: true,
    storage: "native",
  };
}

async function claimDocument(
  client: SupabaseClient,
  input: {
    siteId: string;
    owner: string;
    leaseMs: number;
    now: Date;
  },
): Promise<ClaimStatus | null> {
  const id = operatorClaimDocId(input.siteId);
  const leaseUntil = new Date(input.now.getTime() + input.leaseMs).toISOString();
  const claimedAt = input.now.toISOString();

  const { data: existing } = await client
    .from("revenueos_experiments")
    .select("document")
    .eq("id", id)
    .maybeSingle();

  const doc = (existing?.document ?? null) as {
    owner?: string;
    lease_until?: string;
  } | null;
  if (
    doc?.owner &&
    doc.owner !== input.owner &&
    doc.lease_until &&
    Date.parse(doc.lease_until) > input.now.getTime()
  ) {
    return null;
  }

  const document = {
    site_id: input.siteId,
    owner: input.owner,
    lease_until: leaseUntil,
    claimed_at: claimedAt,
  };
  const { error } = await client.from("revenueos_experiments").upsert(
    {
      id,
      site_id: input.siteId,
      status: "operator_claim",
      pattern_key: `operator_claim:${input.siteId}`,
      category: OPERATOR_CLAIM_CATEGORY,
      document,
      updated_at: claimedAt,
    },
    { onConflict: "id" },
  );
  if (error) return null;
  return {
    siteId: input.siteId,
    owner: input.owner,
    leaseUntil,
    claimedAt,
    active: true,
    storage: "document",
  };
}

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
  const native = await claimNative(client, { ...input, now });
  if (native === "missing_table") {
    return claimDocument(client, { ...input, now });
  }
  return native;
}

export async function releaseBusiness(
  client: SupabaseClient,
  input: { siteId: string; owner: string },
): Promise<void> {
  const expired = new Date(0).toISOString();
  const { error } = await client
    .from(TABLE)
    .update({ lease_until: expired })
    .eq("site_id", input.siteId)
    .eq("owner", input.owner);
  if (!isMissingTableError(error) && !error) return;

  const id = operatorClaimDocId(input.siteId);
  const { data } = await client
    .from("revenueos_experiments")
    .select("document")
    .eq("id", id)
    .maybeSingle();
  const prev = (data?.document ?? {}) as Record<string, unknown>;
  if (prev.owner && prev.owner !== input.owner) return;
  await client.from("revenueos_experiments").upsert(
    {
      id,
      site_id: input.siteId,
      status: "operator_claim",
      pattern_key: `operator_claim:${input.siteId}`,
      category: OPERATOR_CLAIM_CATEGORY,
      document: {
        ...prev,
        site_id: input.siteId,
        owner: input.owner,
        lease_until: expired,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

export async function listActiveClaims(
  client: SupabaseClient,
): Promise<ClaimStatus[]> {
  const now = Date.now();
  const { data, error } = await client
    .from(TABLE)
    .select("site_id,owner,lease_until,claimed_at");
  if (!error && data) {
    return data.map((row) => ({
      siteId: row.site_id,
      owner: row.owner,
      leaseUntil: row.lease_until,
      claimedAt: row.claimed_at,
      active: row.lease_until ? Date.parse(row.lease_until) > now : false,
      storage: "native" as const,
    }));
  }

  const { data: docs } = await client
    .from("revenueos_experiments")
    .select("document")
    .eq("category", OPERATOR_CLAIM_CATEGORY)
    .limit(200);
  return (docs ?? [])
    .map((row) => {
      const d = (row.document ?? {}) as {
        site_id?: string;
        owner?: string;
        lease_until?: string;
        claimed_at?: string;
      };
      if (!d.site_id || !d.owner || !d.lease_until) return null;
      return {
        siteId: d.site_id,
        owner: d.owner,
        leaseUntil: d.lease_until,
        claimedAt: d.claimed_at ?? d.lease_until,
        active: Date.parse(d.lease_until) > now,
        storage: "document" as const,
      };
    })
    .filter((x): x is ClaimStatus => Boolean(x));
}

export async function isClaimedByOperator(
  client: SupabaseClient,
  siteId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from(TABLE)
    .select("lease_until")
    .eq("site_id", siteId)
    .maybeSingle();
  if (!error && data?.lease_until) {
    return Date.parse(data.lease_until) > Date.now();
  }
  const { data: doc } = await client
    .from("revenueos_experiments")
    .select("document")
    .eq("id", operatorClaimDocId(siteId))
    .maybeSingle();
  const lease = (doc?.document as { lease_until?: string } | null)?.lease_until;
  return Boolean(lease && Date.parse(lease) > Date.now());
}
