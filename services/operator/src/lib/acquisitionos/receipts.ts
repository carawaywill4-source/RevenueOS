import { randomBytes } from "node:crypto";
import type pg from "pg";
import { NON_DISTRIBUTION_KINDS } from "./types.js";

function eid(): string {
  return `aqa_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export async function writeDistributionReceipt(
  pool: pg.Pool,
  input: {
    businessId: string;
    channelSurfaceId?: string | null;
    buyer?: string;
    hypothesis: string;
    assetId?: string;
    externalDestination: string;
    externalAction: string;
    executorType: string;
    requestResult: Record<string, unknown>;
    publicUrl?: string | null;
    platformReceipt?: string | null;
    status: string;
    expectedExposure: string;
    referralTracking?: Record<string, unknown>;
    /** Only true when something left RevenueOS onto an external buyer-facing surface. */
    countsAsDistribution: boolean;
    kind?: string;
  },
): Promise<string> {
  const kind = input.kind ?? input.externalAction;
  const counts =
    input.countsAsDistribution && !NON_DISTRIBUTION_KINDS.has(kind);
  const id = eid();
  await pool.query(
    `insert into aq_distribution_receipts (
      action_id, business_id, channel_surface_id, buyer, hypothesis, asset_id,
      external_destination, external_action, executor_type, request_result,
      public_url, platform_receipt, status, expected_exposure, referral_tracking,
      counts_as_distribution
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15::jsonb,$16)`,
    [
      id,
      input.businessId,
      input.channelSurfaceId ?? null,
      input.buyer ?? null,
      input.hypothesis,
      input.assetId ?? null,
      input.externalDestination,
      input.externalAction,
      input.executorType,
      JSON.stringify({ ...input.requestResult, kind }),
      input.publicUrl ?? null,
      input.platformReceipt ?? null,
      input.status,
      input.expectedExposure,
      JSON.stringify(input.referralTracking ?? {}),
      counts,
    ],
  );
  return id;
}

export async function countDistributionReceipts(
  pool: pg.Pool,
  businessId: string,
  hours = 24,
): Promise<number> {
  const res = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where business_id=$1 and counts_as_distribution=true
       and created_at > now() - ($2::text || ' hours')::interval`,
    [businessId, String(hours)],
  );
  return Number(res.rows[0]?.n ?? 0);
}
