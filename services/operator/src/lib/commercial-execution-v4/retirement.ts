/**
 * Real retirement — status column + hosting-plane slot release.
 * Preserves analytics/history. ACTIVE count must drop.
 */

import type pg from "pg";
import { createHostingPlaneClient } from "../hosting-plane-client.js";

export const LIFECYCLE = [
  "ACTIVE",
  "PROBATION",
  "REWORK",
  "RETIRE_CANDIDATE",
  "RETIRED",
  "ARCHIVED",
] as const;
export type Lifecycle = (typeof LIFECYCLE)[number];

export async function countActiveBusinesses(pool: pg.Pool): Promise<number> {
  const r = await pool.query(
    `select count(*)::int as n from ros_businesses
      where lower(status) in ('active','launched','accepted','live','launching','probation')`,
  );
  return Number(r.rows[0]?.n ?? 0);
}

export async function retireBusinessForReal(
  pool: pg.Pool,
  input: { siteId: string; reason: string; preservePublic?: boolean },
): Promise<{ ok: boolean; activeAfter: number; hosting?: unknown }> {
  const existing = await pool.query(
    `select site_id, status, metadata from ros_businesses where site_id=$1`,
    [input.siteId],
  );
  if (!existing.rows[0]) {
    return { ok: false, activeAfter: await countActiveBusinesses(pool) };
  }

  const meta = (existing.rows[0].metadata ?? {}) as Record<string, unknown>;
  const admit = (typeof meta.admit === "object" && meta.admit) ? meta.admit : {};
  const nextMeta = {
    ...meta,
    lifecycle: "RETIRED",
    admit: {
      ...(admit as Record<string, unknown>),
      lifecycle: "RETIRED",
      status: "RETIRED",
      restorable: true,
      retiredAt: new Date().toISOString(),
      retirementReason: input.reason,
    },
  };

  await pool.query(
    `update ros_businesses
        set status='retired',
            metadata=$2::jsonb,
            updated_at=now()
      where site_id=$1`,
    [input.siteId, JSON.stringify(nextMeta)],
  );

  let hosting: unknown = null;
  try {
    const hp = createHostingPlaneClient();
    hosting = await hp.retire(input.siteId);
  } catch (e) {
    hosting = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }

  try {
    const { loadAdmitCheckpoint, saveAdmitCheckpoint } = await import(
      "../portfolio-admit-controller.js"
    );
    const cp = await loadAdmitCheckpoint(pool, 50, 15);
    cp.titanManaged = (cp.titanManaged ?? []).filter((s) => s !== input.siteId);
    cp.accepted = (cp.accepted ?? []).filter((s) => s !== input.siteId);
    const retired = Array.isArray(cp.softRetired) ? cp.softRetired : [];
    if (!retired.includes(input.siteId)) retired.push(input.siteId);
    cp.softRetired = retired.slice(-100);
    if (!cp.replacementRequired.includes(input.siteId)) {
      cp.replacementRequired.push(input.siteId);
    }
    cp.vacantSlots = Math.max(0, (cp.targetPortfolio ?? 50) - cp.titanManaged.length);
    cp.pauseNewAdmissions = cp.titanManaged.length >= (cp.targetPortfolio ?? 50);
    await saveAdmitCheckpoint(pool, cp);
  } catch {
    /* checkpoint optional */
  }

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('cee_v4_retirement', $1::jsonb, now(), 'CEE_V4')
     on conflict (key) do update set
       value = coalesce(ros_config_meta.value, '{}'::jsonb) || excluded.value,
       updated_at=now()`,
    [
      JSON.stringify({
        [input.siteId]: {
          reason: input.reason,
          at: new Date().toISOString(),
          hosting,
        },
      }),
    ],
  ).catch(() => undefined);

  return { ok: true, activeAfter: await countActiveBusinesses(pool), hosting };
}

export async function evaluateRetireCandidates(
  pool: pg.Pool,
): Promise<Array<{ siteId: string; retired: boolean; reason: string }>> {
  const rows = await pool.query(
    `select s.business_id, s.band, s.key_weakness, s.recommended_action, s.tenk_path,
            b.status
       from ros_business_scores s
       join ros_businesses b on b.site_id=s.business_id
      where s.band='RETIRE_CANDIDATE'
        and lower(b.status) not in ('retired','archived')`,
  );
  const out: Array<{ siteId: string; retired: boolean; reason: string }> = [];
  for (const row of rows.rows) {
    const siteId = String(row.business_id);
    const weakness = String(row.key_weakness ?? "");
    const purchases = await pool.query(
      `select count(*)::int as n from ros_customer_events
        where business_id=$1 and kind='PAYMENT_SUCCEEDED'`,
      [siteId],
    ).catch(() => ({ rows: [{ n: 0 }] }));
    if (Number(purchases.rows[0]?.n ?? 0) > 0) {
      out.push({ siteId, retired: false, reason: "has_real_purchases" });
      continue;
    }
    const reason =
      `RETIRE_CANDIDATE band; weakness=${weakness}; tenk_path=${row.tenk_path}; 0 purchases; no credible $10k/day path vs alternatives`;
    if (String(row.recommended_action) !== "PAUSE" && weakness !== "site_unreachable") {
      out.push({ siteId, retired: false, reason: "not_pause_and_reachable_enough" });
      continue;
    }
    const host = process.env.HOSTING_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io";
    let reachable = false;
    try {
      const live = await fetch(`https://${siteId}.${host}/`, {
        method: "GET",
        signal: AbortSignal.timeout(8_000),
        redirect: "follow",
      });
      reachable = live.status >= 200 && live.status < 500;
    } catch {
      // Probe failure is not evidence the business is dead.
      reachable = true;
    }
    if (reachable) {
      out.push({ siteId, retired: false, reason: "public_probe_not_dead_keep" });
      continue;
    }
    const r = await retireBusinessForReal(pool, { siteId, reason });
    out.push({ siteId, retired: r.ok, reason });
  }
  return out;
}

export async function recordOfferEconomics(
  pool: pg.Pool,
  businessId: string,
): Promise<void> {
  const s = await pool.query(
    `select demand, quality, tenk_path, band from ros_business_scores where business_id=$1`,
    [businessId],
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
  const row = s.rows[0];
  if (!row) return;
  const brandPrice = await pool.query(
    `select metadata->>'priceUsd' as p from ros_businesses where site_id=$1`,
    [businessId],
  ).catch(() => ({ rows: [{ p: null }] }));
  const price = Number(brandPrice.rows[0]?.p ?? 0) || null;
  const tenkCustomers = price && price > 0 ? 10000 / price : null;
  let recommended = "";
  const path = String(row.tenk_path ?? "");
  if (path === "IMPLAUSIBLE" && price && price < 100) {
    recommended =
      "Consider professional/implementation/subscription tiers if market evidence appears; do not reprice while verified humans=0";
  }
  await pool.query(
    `insert into ros_offer_economics (
       business_id, price_usd, tenk_customers_per_day, tenk_path,
       recommended_model, evidence, applied, updated_at
     ) values ($1,$2,$3,$4,$5,$6,false, now())
     on conflict (business_id) do update set
       price_usd=excluded.price_usd,
       tenk_customers_per_day=excluded.tenk_customers_per_day,
       tenk_path=excluded.tenk_path,
       recommended_model=excluded.recommended_model,
       evidence=excluded.evidence,
       updated_at=now()`,
    [
      businessId,
      price,
      tenkCustomers,
      path,
      recommended,
      `band=${row.band}; do not mutate offer without human evidence`,
    ],
  );
}
