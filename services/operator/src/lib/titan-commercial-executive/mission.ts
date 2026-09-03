import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { buildBuyerHabitat } from "../acquisitionos/buyer-habitat.js";
import { evaluateEconomicFeasibility } from "./economic-feasibility.js";

function repoRoot(): string {
  return (
    process.env.REVENUEOS_REPO_ROOT ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  );
}

function loadPriceOffer(siteId: string): {
  price: number | null;
  offer: string;
  name: string;
} {
  const p = path.join(repoRoot(), "apps", siteId, "src/lib/brand.ts");
  if (!existsSync(p)) return { price: null, offer: "unknown", name: siteId };
  const src = readFileSync(p, "utf8");
  const price = Number(src.match(/"priceUsd"\s*:\s*([0-9.]+)/)?.[1] ?? NaN);
  const offer = src.match(/"name"\s*:\s*"([^"]+)"/)?.[1] ?? siteId;
  const name = src.match(/"displayName"\s*:\s*"([^"]+)"/)?.[1] ?? siteId;
  return {
    price: Number.isFinite(price) ? price : null,
    offer,
    name,
  };
}

export type PathModel = {
  priceUsd: number;
  purchasesPerDay: number;
  assumedConversion: number;
  requiredQualifiedVisitsPerDay: number;
  requiredImpressionsPerDay: number;
  plausible: boolean;
  note: string;
  feasibilityClass?: string;
  feasibilityScore?: number;
};

export function modelTenKPath(
  priceUsd: number | null,
  extras?: {
    revenueModel?: string | null;
    organic?: string | null;
    crowded?: boolean;
  },
): PathModel {
  const f = evaluateEconomicFeasibility({
    priceUsd,
    revenueModel: extras?.revenueModel ?? "one_shot",
    organic: extras?.organic ?? null,
    crowded: extras?.crowded ?? false,
  });
  return {
    priceUsd: f.priceUsd,
    purchasesPerDay: f.purchasesPerDay,
    assumedConversion: 0.02,
    requiredQualifiedVisitsPerDay: f.requiredQualifiedVisitsPerDay,
    requiredImpressionsPerDay: f.requiredImpressionsPerDay,
    plausible: f.plausible,
    note: f.note,
    feasibilityClass: f.class,
    feasibilityScore: f.score,
  };
}

export async function syncCommercialMission(
  pool: pg.Pool,
  businessId: string,
): Promise<Record<string, unknown>> {
  const habitat = buildBuyerHabitat(businessId);
  const brand = loadPriceOffer(businessId);
  const pathModel = modelTenKPath(brand.price);

  const purchases = await pool.query(
    `select count(*)::int as n,
            coalesce(sum(amount_cents),0)::bigint as cents
     from ros_purchases
     where business_id=$1
       and stripe_session_id not like 'cs_test_%'
       and coalesce(meta->>'payment_status','paid') <> 'unpaid'`,
    [businessId],
  );
  const realPurchases = Number(purchases.rows[0]?.n ?? 0);
  const revenueUsd = Number(purchases.rows[0]?.cents ?? 0) / 100;

  // Only count humans with an external referer (not self-host / empty).
  // Browser UA alone is not Titan-attributed buyer evidence.
  const traffic = await pool.query(
    `select
       count(*) filter (
         where class='LIKELY_HUMAN'
           and coalesce(referer,'') <> ''
           and referer not ilike '%sslip.io%'
           and referer not ilike '%130.131.15.68%'
           and referer not ilike '%' || $1 || '%'
       )::int as human,
       count(*) filter (where class='QUALIFIED' or qualified=true)::int as qualified
     from ros_traffic_events
     where business_id=$1 and created_at > now() - interval '30 days'`,
    [businessId],
  );
  const qualified = Number(traffic.rows[0]?.qualified ?? 0);
  const human = Number(traffic.rows[0]?.human ?? 0);

  const newAud = await pool.query(
    `select max(created_at) as last_at, count(*)::int as n
     from aq_distribution_receipts
     where business_id=$1 and is_new_audience=true`,
    [businessId],
  );
  const newAudN = Number(newAud.rows[0]?.n ?? 0);
  const lastNewAudRaw = newAud.rows[0]?.last_at;
  const lastNewAud = lastNewAudRaw
    ? new Date(lastNewAudRaw as string | Date).toISOString()
    : null;

  // Primary bottleneck from commercial truth — prefer verified third-party exposure
  const verified = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where business_id=$1 and is_new_audience=true
       and status in ('PUBLISHED','EXPOSURE_CONFIRMED','EXPOSED')`,
    [businessId],
  );
  const verifiedN = Number(verified.rows[0]?.n ?? 0);

  let primary = "NO_NEW_AUDIENCE_DISTRIBUTION";
  let rung = "STAGE_0_NO_VERIFIED_EXPOSURE";
  if (realPurchases > 0) {
    primary = "REPLICATE_CUSTOMER";
    rung = "STAGE_6_CUSTOMER";
  } else if (qualified > 0) {
    primary = "CONVERSION";
    rung = "STAGE_4_QUALIFIED_OR_INTENT";
  } else if (human > 0) {
    primary = "NO_QUALIFIED_ENGAGEMENT";
    rung = "STAGE_2_VISITORS_NO_ENGAGEMENT";
  } else if (verifiedN > 0) {
    primary = "NO_IMPRESSIONS_OR_VISITS";
    rung = "STAGE_1_EXPOSURE_NO_VISITORS";
  } else if (newAudN > 0) {
    primary = "NO_VERIFIED_THIRD_PARTY_EXPOSURE";
    rung = "STAGE_0_NO_VERIFIED_EXPOSURE";
  }

  const secondary =
    !pathModel.plausible
      ? "UNIT_ECONOMICS_OR_OFFER_CEILING"
      : habitat.clarityScore < 0.5
        ? "BUYER_CLARITY"
        : "CHANNEL_EXPERIMENTATION";

  // Acquisition state: must have recent new-audience or documented blocker
  const recentNew = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where business_id=$1 and is_new_audience=true
       and created_at > now() - interval '6 hours'`,
    [businessId],
  );
  const acquisitionState =
    Number(recentNew.rows[0]?.n ?? 0) > 0
      ? "ACTIVE_NEW_AUDIENCE"
      : "STALLED";

  const hoursSinceNew = lastNewAud
    ? (Date.now() - Date.parse(lastNewAud)) / 3_600_000
    : 999;
  const failStreak = await pool.query(
    `select count(*)::int as n from titan_commercial_failures
     where business_id=$1 and created_at > now() - interval '24 hours'`,
    [businessId],
  ).catch(() => ({ rows: [{ n: 0 }] }));
  const fails = Number(failStreak.rows[0]?.n ?? 0);
  // COMMERCIAL_FAILURE_PRESSURE — rises with stagnation & failed learning
  const pressure = Math.min(
    1,
    0.3 +
      (qualified === 0 ? 0.2 : 0) +
      (human === 0 ? 0.1 : 0) +
      (newAudN === 0 ? 0.2 : Math.min(0.15, hoursSinceNew / 48)) +
      (acquisitionState === "STALLED" ? 0.12 : 0) +
      Math.min(0.15, fails * 0.04) +
      (!pathModel.plausible ? 0.08 : 0),
  );

  const nextAction =
    primary === "NO_NEW_AUDIENCE_DISTRIBUTION" ||
    primary === "NO_VERIFIED_THIRD_PARTY_EXPOSURE"
      ? "research_and_execute_verified_distribution"
      : primary === "NO_IMPRESSIONS_OR_VISITS"
        ? "rotate_channel_and_message"
        : primary === "NO_QUALIFIED_ENGAGEMENT"
          ? "improve_landing_match"
          : primary === "REPLICATE_CUSTOMER"
            ? "trace_and_replicate_winning_path"
            : "iterate_offer_or_price";

  const doc = {
    pathModel,
    habitatClarity: habitat.clarityScore,
    humanVisits30d: human,
    displayName: brand.name,
  };

  await pool.query(
    `insert into titan_business_commercial_missions (
       business_id, mission, target_daily_revenue, current_real_daily_revenue,
       real_customers, real_purchases, qualified_visits, checkout_starts,
       primary_bottleneck, secondary_bottleneck, buyer, offer, price_usd,
       revenue_model, next_action, confidence, distance_to_goal,
       last_new_audience_at, commercial_pressure, funnel_rung, acquisition_state,
       first_human_war_mode, document, status, updated_at
     ) values (
       $1,$2,10000,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,'one_shot_digital',$12,$13,$14,
       $15,$16,$17,$18,$19,$20::jsonb,'ACTIVE',now()
     )
     on conflict (business_id) do update set
       current_real_daily_revenue=excluded.current_real_daily_revenue,
       real_customers=excluded.real_customers,
       real_purchases=excluded.real_purchases,
       qualified_visits=excluded.qualified_visits,
       primary_bottleneck=excluded.primary_bottleneck,
       secondary_bottleneck=excluded.secondary_bottleneck,
       buyer=excluded.buyer,
       offer=excluded.offer,
       price_usd=excluded.price_usd,
       next_action=excluded.next_action,
       confidence=excluded.confidence,
       distance_to_goal=excluded.distance_to_goal,
       last_new_audience_at=coalesce(excluded.last_new_audience_at, titan_business_commercial_missions.last_new_audience_at),
       commercial_pressure=excluded.commercial_pressure,
       funnel_rung=excluded.funnel_rung,
       acquisition_state=excluded.acquisition_state,
       first_human_war_mode=excluded.first_human_war_mode,
       document=excluded.document,
       updated_at=now()`,
    [
      businessId,
      `Build ${brand.name} toward $10,000/day in real revenue`,
      revenueUsd,
      realPurchases,
      realPurchases,
      qualified,
      primary,
      secondary,
      habitat.buyerPersona,
      brand.offer,
      brand.price,
      nextAction,
      Math.min(0.85, 0.35 + habitat.clarityScore * 0.4),
      Math.max(0, 10000 - revenueUsd),
      lastNewAud,
      pressure,
      rung,
      acquisitionState,
      qualified === 0,
      JSON.stringify(doc),
    ],
  );

  return {
    businessId,
    primary,
    secondary,
    rung,
    acquisitionState,
    pressure,
    pathModel,
    nextAction,
    newAudienceActions: newAudN,
    qualified,
  };
}
